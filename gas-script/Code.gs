/**
 * Googleスプレッドシート → Supabase 自動同期スクリプト
 *
 * セットアップ手順：
 * 1. Googleスプレッドシートを開く
 * 2. 「拡張機能」→「Apps Script」を選択
 * 3. このコードをコピー＆ペースト
 * 4. 下記の設定値を入力
 * 5. 保存して「syncToSupabase」関数を実行してテスト
 * 6. トリガーを設定（編集時に実行）
 */

// ============================================
// 【重要】ここに設定を入力してください
// ============================================
const SUPABASE_URL = 'https://srxbdcfcykgqmnlcqdcr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNyeGJkY2ZjeWtncW1ubGNxZGNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0Mjg4NjYsImV4cCI6MjA3NzAwNDg2Nn0.ySlM6FE0cW4yjj1eP741xXDBDBg4Ca9Tfdsuf0_Hbsg';

// シート名（変更可能）
const SHEET_NAME = '営業データ';

/**
 * スプレッドシート編集時に自動実行される関数
 * トリガーで設定してください
 */
function onEdit(e) {
  // 編集された範囲を取得
  const range = e.range;
  const sheet = range.getSheet();

  // 指定したシート以外は無視
  if (sheet.getName() !== SHEET_NAME) {
    return;
  }

  // 1行目（ヘッダー）の編集は無視
  if (range.getRow() === 1) {
    return;
  }

  // J列（送信済みフラグ）の編集は無視
  if (range.getColumn() === 10) {
    return;
  }

  // 必須項目がすべて入力されているかチェック（A-G列）
  const row = range.getRow();
  const rowData = sheet.getRange(row, 1, 1, 7).getValues()[0];

  // 必須項目のいずれかが空の場合はスキップ
  if (!rowData[0] || !rowData[1] || !rowData[2] || !rowData[3] || !rowData[4] || !rowData[5] || !rowData[6]) {
    return;
  }

  // データをSupabaseに同期
  syncRowToSupabase(sheet, row);
}

/**
 * 手動で全データを同期する関数
 * メニューから実行できます
 */
function syncAllData() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);

  if (!sheet) {
    Browser.msgBox('エラー', 'シート "' + SHEET_NAME + '" が見つかりません', Browser.Buttons.OK);
    return;
  }

  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    Browser.msgBox('情報', 'データがありません', Browser.Buttons.OK);
    return;
  }

  let successCount = 0;
  let errorCount = 0;

  // 2行目から最終行まで処理
  for (let i = 2; i <= lastRow; i++) {
    try {
      syncRowToSupabase(sheet, i);
      successCount++;
    } catch (error) {
      Logger.log('行 ' + i + ' のエラー: ' + error);
      errorCount++;
    }
  }

  Browser.msgBox('同期完了',
    '成功: ' + successCount + '件\nエラー: ' + errorCount + '件',
    Browser.Buttons.OK);
}

/**
 * 指定した行のデータをSupabaseに送信
 */
function syncRowToSupabase(sheet, rowNumber) {
  // J列（送信済みフラグ）をチェック
  const syncedFlag = sheet.getRange(rowNumber, 10).getValue();

  // 既に送信済みの場合はスキップ
  if (syncedFlag === '✓') {
    Logger.log('行 ' + rowNumber + ' は送信済みのためスキップしました');
    return;
  }

  // 行のデータを取得（A-I列）
  const rowData = sheet.getRange(rowNumber, 1, 1, 9).getValues()[0];

  // 空行はスキップ
  if (!rowData[0]) {
    return;
  }

  // データオブジェクトを作成
  const salesRecord = {
    date: formatDate(rowData[0]),
    customer_name: rowData[1] || '',
    product_name: rowData[2] || '',
    quantity: parseInt(rowData[3]) || 0,
    unit_price: parseFloat(rowData[4]) || 0,
    total_amount: parseFloat(rowData[5]) || 0,
    sales_person: rowData[6] || '',
    category: rowData[7] || null,
    notes: rowData[8] || null
  };

  // Supabase APIにPOSTリクエスト
  const url = SUPABASE_URL + '/rest/v1/sales_records';

  const options = {
    'method': 'post',
    'headers': {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    'payload': JSON.stringify(salesRecord),
    'muteHttpExceptions': true
  };

  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();

  if (responseCode !== 201) {
    Logger.log('エラー: ' + response.getContentText());
    throw new Error('Supabaseへの送信に失敗しました: ' + responseCode);
  }

  // 送信成功後、J列に送信済みフラグを設定
  sheet.getRange(rowNumber, 10).setValue('✓');

  Logger.log('行 ' + rowNumber + ' を同期しました');
}

/**
 * 日付をYYYY-MM-DD形式に変換
 */
function formatDate(date) {
  if (date instanceof Date) {
    const year = date.getFullYear();
    const month = ('0' + (date.getMonth() + 1)).slice(-2);
    const day = ('0' + date.getDate()).slice(-2);
    return year + '-' + month + '-' + day;
  }
  return date;
}

/**
 * カスタムメニューを追加
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Supabase同期')
    .addItem('全データを同期', 'syncAllData')
    .addItem('送信済みフラグをクリア', 'clearSyncedFlags')
    .addSeparator()
    .addItem('設定をテスト', 'testConnection')
    .addToUi();
}

/**
 * すべての送信済みフラグをクリア
 * データを再送信したい場合に使用
 */
function clearSyncedFlags() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);

  if (!sheet) {
    Browser.msgBox('エラー', 'シート "' + SHEET_NAME + '" が見つかりません', Browser.Buttons.OK);
    return;
  }

  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    Browser.msgBox('情報', 'データがありません', Browser.Buttons.OK);
    return;
  }

  // 確認ダイアログ
  const result = Browser.msgBox(
    '確認',
    'すべての送信済みフラグをクリアしますか？\n（データは削除されません）',
    Browser.Buttons.OK_CANCEL
  );

  if (result !== 'ok') {
    return;
  }

  // J列の2行目から最終行までクリア
  sheet.getRange(2, 10, lastRow - 1, 1).clearContent();

  Browser.msgBox('完了', '送信済みフラグをクリアしました', Browser.Buttons.OK);
}

/**
 * Supabase接続テスト
 */
function testConnection() {
  try {
    const url = SUPABASE_URL + '/rest/v1/sales_records?limit=1';

    const options = {
      'method': 'get',
      'headers': {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
      },
      'muteHttpExceptions': true
    };

    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();

    if (responseCode === 200) {
      Browser.msgBox('成功', 'Supabaseに正常に接続できました！', Browser.Buttons.OK);
    } else {
      Browser.msgBox('エラー', '接続に失敗しました。ステータスコード: ' + responseCode, Browser.Buttons.OK);
    }
  } catch (error) {
    Browser.msgBox('エラー', 'エラーが発生しました: ' + error, Browser.Buttons.OK);
  }
}
