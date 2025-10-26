/**
 * Googleスプレッドシート → Supabase 自動同期スクリプト（拡張版）
 *
 * セットアップ手順：
 * 1. Googleスプレッドシートを開く
 * 2. 「拡張機能」→「Apps Script」を選択
 * 3. このコードをコピー＆ペースト
 * 4. 下記の設定値を入力
 * 5. 保存して「syncAllData」関数を実行してテスト
 * 6. トリガーを設定（編集時に実行）
 *
 * 【新機能】
 * - 営業担当者情報も自動同期
 * - 2つのシートを管理：「営業データ」「営業担当者」
 */

// ============================================
// 【重要】ここに設定を入力してください
// ============================================
const SUPABASE_URL = 'https://srxbdcfcykgqmnlcqdcr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNyeGJkY2ZjeWtncW1ubGNxZGNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0Mjg4NjYsImV4cCI6MjA3NzAwNDg2Nn0.ySlM6FE0cW4yjj1eP741xXDBDBg4Ca9Tfdsuf0_Hbsg';

// シート名（変更可能）
const SALES_SHEET_NAME = '営業データ';
const PEOPLE_SHEET_NAME = '営業担当者';

/**
 * スプレッドシート編集時に自動実行される関数
 * トリガーで設定してください
 */
function onEdit(e) {
  const range = e.range;
  const sheet = range.getSheet();
  const sheetName = sheet.getName();

  // 営業データシートの編集
  if (sheetName === SALES_SHEET_NAME) {
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
    syncSalesRowToSupabase(sheet, row);
  }
  // 営業担当者シートの編集
  else if (sheetName === PEOPLE_SHEET_NAME) {
    // 1行目（ヘッダー）の編集は無視
    if (range.getRow() === 1) {
      return;
    }

    // G列（送信済みフラグ）の編集は無視
    if (range.getColumn() === 7) {
      return;
    }

    // 名前（A列）が入力されているかチェック
    const row = range.getRow();
    const name = sheet.getRange(row, 1).getValue();

    if (!name) {
      return;
    }

    // 営業担当者データをSupabaseに同期
    syncPersonRowToSupabase(sheet, row);
  }
}

/**
 * 手動で全データを同期する関数
 * メニューから実行できます
 */
function syncAllData() {
  let message = '';

  // 営業データの同期
  const salesSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SALES_SHEET_NAME);
  if (salesSheet) {
    const salesResult = syncAllSalesData(salesSheet);
    message += '【営業データ】\n成功: ' + salesResult.success + '件\nエラー: ' + salesResult.error + '件\n\n';
  } else {
    message += '【営業データ】\nシートが見つかりません\n\n';
  }

  // 営業担当者の同期
  const peopleSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PEOPLE_SHEET_NAME);
  if (peopleSheet) {
    const peopleResult = syncAllPeopleData(peopleSheet);
    message += '【営業担当者】\n成功: ' + peopleResult.success + '件\nエラー: ' + peopleResult.error + '件';
  } else {
    message += '【営業担当者】\nシートが見つかりません';
  }

  Browser.msgBox('同期完了', message, Browser.Buttons.OK);
}

/**
 * 営業データを全件同期
 */
function syncAllSalesData(sheet) {
  const lastRow = sheet.getLastRow();
  let successCount = 0;
  let errorCount = 0;

  if (lastRow <= 1) {
    return { success: 0, error: 0 };
  }

  for (let i = 2; i <= lastRow; i++) {
    try {
      syncSalesRowToSupabase(sheet, i);
      successCount++;
    } catch (error) {
      Logger.log('営業データ 行 ' + i + ' のエラー: ' + error);
      errorCount++;
    }
  }

  return { success: successCount, error: errorCount };
}

/**
 * 営業担当者データを全件同期
 */
function syncAllPeopleData(sheet) {
  const lastRow = sheet.getLastRow();
  let successCount = 0;
  let errorCount = 0;

  if (lastRow <= 1) {
    return { success: 0, error: 0 };
  }

  for (let i = 2; i <= lastRow; i++) {
    try {
      syncPersonRowToSupabase(sheet, i);
      successCount++;
    } catch (error) {
      Logger.log('営業担当者 行 ' + i + ' のエラー: ' + error);
      errorCount++;
    }
  }

  return { success: successCount, error: errorCount };
}

/**
 * 指定した行の営業データをSupabaseに送信
 */
function syncSalesRowToSupabase(sheet, rowNumber) {
  // J列（送信済みフラグ）をチェック
  const syncedFlag = sheet.getRange(rowNumber, 10).getValue();

  // 既に送信済みの場合はスキップ
  if (syncedFlag === '✓') {
    Logger.log('営業データ 行 ' + rowNumber + ' は送信済みのためスキップしました');
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

  Logger.log('営業データ 行 ' + rowNumber + ' を同期しました');
}

/**
 * 指定した行の営業担当者データをSupabaseに送信（UPSERT）
 */
function syncPersonRowToSupabase(sheet, rowNumber) {
  // G列（送信済みフラグ）をチェック
  const syncedFlag = sheet.getRange(rowNumber, 7).getValue();

  // 既に送信済みの場合はスキップ
  if (syncedFlag === '✓') {
    Logger.log('営業担当者 行 ' + rowNumber + ' は送信済みのためスキップしました');
    return;
  }

  // 行のデータを取得（A-F列）
  const rowData = sheet.getRange(rowNumber, 1, 1, 6).getValues()[0];

  // 名前が空の場合はスキップ
  if (!rowData[0]) {
    return;
  }

  // データオブジェクトを作成
  const personData = {
    name: rowData[0] || '',
    department: rowData[1] || null,
    email: rowData[2] || null,
    monthly_target: parseFloat(rowData[3]) || 0,
    quarterly_target: parseFloat(rowData[4]) || 0,
    hire_date: formatDate(rowData[5]) || null
  };

  // UPSERTを使用（既存の場合は更新、新規の場合は追加）
  const url = SUPABASE_URL + '/rest/v1/sales_people';

  const options = {
    'method': 'post',
    'headers': {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=minimal'
    },
    'payload': JSON.stringify(personData),
    'muteHttpExceptions': true
  };

  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();

  if (responseCode !== 201) {
    Logger.log('エラー: ' + response.getContentText());
    throw new Error('Supabaseへの送信に失敗しました: ' + responseCode);
  }

  // 送信成功後、G列に送信済みフラグを設定
  sheet.getRange(rowNumber, 7).setValue('✓');

  Logger.log('営業担当者 行 ' + rowNumber + ' を同期しました');
}

/**
 * 日付をYYYY-MM-DD形式に変換
 */
function formatDate(date) {
  if (!date) {
    return null;
  }

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
    .addItem('営業データのみ同期', 'syncSalesDataOnly')
    .addItem('営業担当者のみ同期', 'syncPeopleDataOnly')
    .addSeparator()
    .addItem('送信済みフラグをクリア（営業データ）', 'clearSalesSyncedFlags')
    .addItem('送信済みフラグをクリア（営業担当者）', 'clearPeopleSyncedFlags')
    .addSeparator()
    .addItem('設定をテスト', 'testConnection')
    .addToUi();
}

/**
 * 営業データのみ同期
 */
function syncSalesDataOnly() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SALES_SHEET_NAME);

  if (!sheet) {
    Browser.msgBox('エラー', 'シート "' + SALES_SHEET_NAME + '" が見つかりません', Browser.Buttons.OK);
    return;
  }

  const result = syncAllSalesData(sheet);
  Browser.msgBox('同期完了', '成功: ' + result.success + '件\nエラー: ' + result.error + '件', Browser.Buttons.OK);
}

/**
 * 営業担当者のみ同期
 */
function syncPeopleDataOnly() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PEOPLE_SHEET_NAME);

  if (!sheet) {
    Browser.msgBox('エラー', 'シート "' + PEOPLE_SHEET_NAME + '" が見つかりません', Browser.Buttons.OK);
    return;
  }

  const result = syncAllPeopleData(sheet);
  Browser.msgBox('同期完了', '成功: ' + result.success + '件\nエラー: ' + result.error + '件', Browser.Buttons.OK);
}

/**
 * 営業データの送信済みフラグをクリア
 */
function clearSalesSyncedFlags() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SALES_SHEET_NAME);

  if (!sheet) {
    Browser.msgBox('エラー', 'シート "' + SALES_SHEET_NAME + '" が見つかりません', Browser.Buttons.OK);
    return;
  }

  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    Browser.msgBox('情報', 'データがありません', Browser.Buttons.OK);
    return;
  }

  const result = Browser.msgBox(
    '確認',
    '営業データの送信済みフラグをすべてクリアしますか？',
    Browser.Buttons.OK_CANCEL
  );

  if (result !== 'ok') {
    return;
  }

  sheet.getRange(2, 10, lastRow - 1, 1).clearContent();
  Browser.msgBox('完了', '送信済みフラグをクリアしました', Browser.Buttons.OK);
}

/**
 * 営業担当者の送信済みフラグをクリア
 */
function clearPeopleSyncedFlags() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PEOPLE_SHEET_NAME);

  if (!sheet) {
    Browser.msgBox('エラー', 'シート "' + PEOPLE_SHEET_NAME + '" が見つかりません', Browser.Buttons.OK);
    return;
  }

  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    Browser.msgBox('情報', 'データがありません', Browser.Buttons.OK);
    return;
  }

  const result = Browser.msgBox(
    '確認',
    '営業担当者の送信済みフラグをすべてクリアしますか？',
    Browser.Buttons.OK_CANCEL
  );

  if (result !== 'ok') {
    return;
  }

  sheet.getRange(2, 7, lastRow - 1, 1).clearContent();
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
