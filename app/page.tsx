'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Line, BarChart, Bar, ComposedChart, LineChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { TrendingUp, DollarSign, ShoppingCart, Users, ExternalLink } from 'lucide-react'
import SalesPersonDetailModal from '@/components/SalesPersonDetailModal'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

interface SalesRecord {
  id: string
  date: string
  customer_name: string
  product_name: string
  quantity: number
  unit_price: number
  total_amount: number
  sales_person: string
  category: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export default function Dashboard() {
  const [salesData, setSalesData] = useState<SalesRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSalesPerson, setSelectedSalesPerson] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    fetchSalesData()

    // リアルタイム更新のサブスクリプション
    const channel = supabase
      .channel('sales_records_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sales_records' },
        () => {
          fetchSalesData()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  async function fetchSalesData() {
    try {
      const { data, error } = await supabase
        .from('sales_records')
        .select('*')
        .order('date', { ascending: true })

      if (error) throw error
      setSalesData(data || [])
    } catch (error) {
      console.error('Error fetching sales data:', error)
    } finally {
      setLoading(false)
    }
  }

  // 集計データの計算
  const totalSales = salesData.reduce((sum, record) => sum + Number(record.total_amount), 0)
  const totalOrders = salesData.length
  const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0
  const uniqueCustomers = new Set(salesData.map(r => r.customer_name)).size

  // 日別売上データ
  const dailySales = salesData.reduce((acc, record) => {
    const date = record.date
    if (!acc[date]) {
      acc[date] = { date, amount: 0, count: 0 }
    }
    acc[date].amount += Number(record.total_amount)
    acc[date].count += 1
    return acc
  }, {} as Record<string, { date: string; amount: number; count: number }>)

  // 週別売上データ（日曜日始まり）
  const weeklySales = salesData.reduce((acc, record) => {
    const date = new Date(record.date)
    // 週の開始日（日曜日）を取得
    const startOfWeek = new Date(date)
    startOfWeek.setDate(date.getDate() - date.getDay())
    const weekKey = startOfWeek.toISOString().split('T')[0]

    if (!acc[weekKey]) {
      acc[weekKey] = { date: weekKey, amount: 0, count: 0 }
    }
    acc[weekKey].amount += Number(record.total_amount)
    acc[weekKey].count += 1
    return acc
  }, {} as Record<string, { date: string; amount: number; count: number }>)

  // 月別売上データ
  const monthlySales = salesData.reduce((acc, record) => {
    const yearMonth = record.date.substring(0, 7) // YYYY-MM形式
    if (!acc[yearMonth]) {
      acc[yearMonth] = { date: yearMonth, amount: 0, count: 0 }
    }
    acc[yearMonth].amount += Number(record.total_amount)
    acc[yearMonth].count += 1
    return acc
  }, {} as Record<string, { date: string; amount: number; count: number }>)

  // 累積売上を計算する関数
  const addCumulative = (data: { date: string; amount: number; count?: number }[]) => {
    let cumulative = 0
    return data.map((item) => {
      cumulative += item.amount
      return { ...item, cumulative }
    })
  }

  // 各期間のデータを累積付きで作成
  const dailyChartData = addCumulative(Object.values(dailySales))
  const weeklyChartData = addCumulative(Object.values(weeklySales))
  const monthlyChartData = addCumulative(Object.values(monthlySales))

  // カテゴリ別売上（日別）
  const dailyCategorySales = salesData.reduce((acc, record) => {
    const date = record.date
    if (!acc[date]) {
      acc[date] = {}
    }
    const category = record.category || '未分類'
    if (!acc[date][category]) {
      acc[date][category] = 0
    }
    acc[date][category] += Number(record.total_amount)
    return acc
  }, {} as Record<string, Record<string, number>>)

  // カテゴリ別売上（月別）
  const monthlyCategorySales = salesData.reduce((acc, record) => {
    const yearMonth = record.date.substring(0, 7) // YYYY-MM形式
    if (!acc[yearMonth]) {
      acc[yearMonth] = {}
    }
    const category = record.category || '未分類'
    if (!acc[yearMonth][category]) {
      acc[yearMonth][category] = 0
    }
    acc[yearMonth][category] += Number(record.total_amount)
    return acc
  }, {} as Record<string, Record<string, number>>)

  // チャート用のデータに変換
  const getDailyCategoryChartData = () => {
    const allCategories = new Set<string>()
    Object.values(dailyCategorySales).forEach(categories => {
      Object.keys(categories).forEach(cat => allCategories.add(cat))
    })

    return Object.entries(dailyCategorySales).map(([date, categories]) => ({
      date,
      ...categories
    }))
  }

  const getMonthlyCategoryChartData = () => {
    const allCategories = new Set<string>()
    Object.values(monthlyCategorySales).forEach(categories => {
      Object.keys(categories).forEach(cat => allCategories.add(cat))
    })

    return Object.entries(monthlyCategorySales).map(([date, categories]) => ({
      date,
      ...categories
    }))
  }

  // 全カテゴリのリストを取得
  const allCategories = Array.from(new Set(salesData.map(r => r.category || '未分類')))

  // カテゴリごとの色を定義
  const categoryColors = [
    '#8b5cf6', '#60a5fa', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#f97316'
  ]
  const categoryColorMap = allCategories.reduce((acc, cat, idx) => {
    acc[cat] = categoryColors[idx % categoryColors.length]
    return acc
  }, {} as Record<string, string>)

  // 営業担当者の一覧を取得
  const salesPersonList = Array.from(new Set(salesData.map(r => r.sales_person)))

  // 営業担当者ごとの色を定義
  const salesPersonColors: Record<string, string> = {
    '松澤': '#60a5fa',
    '坂口': '#10b981',
    '斉藤': '#f59e0b',
    '泉水': '#8b5cf6',
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-slate-300 text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* ヘッダー */}
        <div className="text-center space-y-4">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-violet-400">
              Sales Visualization
            </h1>
            <p className="text-slate-400">営業データをリアルタイムで可視化</p>
          </div>

          {/* スプレッドシートへのリンクボタン */}
          {process.env.NEXT_PUBLIC_SPREADSHEET_URL && (
            <div className="flex justify-center">
              <a
                href={process.env.NEXT_PUBLIC_SPREADSHEET_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
              >
                <ExternalLink className="h-5 w-5" />
                <span>スプレッドシートを開く</span>
              </a>
            </div>
          )}
        </div>

        {/* KPIカード */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm hover:bg-slate-800/70 transition-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">総売上</CardTitle>
              <DollarSign className="h-4 w-4 text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-400">¥{totalSales.toLocaleString()}</div>
              <p className="text-xs text-slate-500 mt-1">累計売上金額</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm hover:bg-slate-800/70 transition-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">注文数</CardTitle>
              <ShoppingCart className="h-4 w-4 text-violet-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-violet-400">{totalOrders}</div>
              <p className="text-xs text-slate-500 mt-1">総注文件数</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm hover:bg-slate-800/70 transition-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">平均注文額</CardTitle>
              <TrendingUp className="h-4 w-4 text-emerald-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-400">¥{Math.round(avgOrderValue).toLocaleString()}</div>
              <p className="text-xs text-slate-500 mt-1">1注文あたりの平均金額</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm hover:bg-slate-800/70 transition-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">顧客数</CardTitle>
              <Users className="h-4 w-4 text-amber-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-400">{uniqueCustomers}</div>
              <p className="text-xs text-slate-500 mt-1">ユニーク顧客数</p>
            </CardContent>
          </Card>
        </div>

        {/* チャート */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-slate-200">売上推移</CardTitle>
              <CardDescription className="text-slate-400">期間別の売上（棒）と累積売上（線）</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="daily" className="w-full">
                <TabsList className="grid w-full grid-cols-3 bg-slate-700/50 mb-4">
                  <TabsTrigger value="daily" className="data-[state=active]:bg-slate-600 data-[state=active]:text-white">
                    日別
                  </TabsTrigger>
                  <TabsTrigger value="weekly" className="data-[state=active]:bg-slate-600 data-[state=active]:text-white">
                    週別
                  </TabsTrigger>
                  <TabsTrigger value="monthly" className="data-[state=active]:bg-slate-600 data-[state=active]:text-white">
                    月別
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="daily" className="mt-0">
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={dailyChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1e293b',
                          border: '1px solid #334155',
                          borderRadius: '8px',
                          color: '#e2e8f0'
                        }}
                      />
                      <Legend wrapperStyle={{ color: '#94a3b8' }} />
                      <Bar dataKey="amount" fill="#60a5fa" name="日別売上" />
                      <Line type="monotone" dataKey="cumulative" stroke="#f59e0b" strokeWidth={2} name="累積売上" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </TabsContent>

                <TabsContent value="weekly" className="mt-0">
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={weeklyChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1e293b',
                          border: '1px solid #334155',
                          borderRadius: '8px',
                          color: '#e2e8f0'
                        }}
                      />
                      <Legend wrapperStyle={{ color: '#94a3b8' }} />
                      <Bar dataKey="amount" fill="#60a5fa" name="週別売上" />
                      <Line type="monotone" dataKey="cumulative" stroke="#f59e0b" strokeWidth={2} name="累積売上" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </TabsContent>

                <TabsContent value="monthly" className="mt-0">
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={monthlyChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1e293b',
                          border: '1px solid #334155',
                          borderRadius: '8px',
                          color: '#e2e8f0'
                        }}
                      />
                      <Legend wrapperStyle={{ color: '#94a3b8' }} />
                      <Bar dataKey="amount" fill="#60a5fa" name="月別売上" />
                      <Line type="monotone" dataKey="cumulative" stroke="#f59e0b" strokeWidth={2} name="累積売上" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-slate-200">カテゴリ別売上</CardTitle>
              <CardDescription className="text-slate-400">商品カテゴリ別の売上分析</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="daily" className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-slate-700/50 mb-4">
                  <TabsTrigger value="daily" className="data-[state=active]:bg-slate-600 data-[state=active]:text-white">
                    日別
                  </TabsTrigger>
                  <TabsTrigger value="monthly" className="data-[state=active]:bg-slate-600 data-[state=active]:text-white">
                    月別
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="daily" className="mt-0">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={getDailyCategoryChartData()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1e293b',
                          border: '1px solid #334155',
                          borderRadius: '8px',
                          color: '#e2e8f0'
                        }}
                      />
                      <Legend wrapperStyle={{ color: '#94a3b8' }} />
                      {allCategories.map((category) => (
                        <Bar
                          key={category}
                          dataKey={category}
                          fill={categoryColorMap[category]}
                          name={category}
                          stackId="a"
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </TabsContent>

                <TabsContent value="monthly" className="mt-0">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={getMonthlyCategoryChartData()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1e293b',
                          border: '1px solid #334155',
                          borderRadius: '8px',
                          color: '#e2e8f0'
                        }}
                      />
                      <Legend wrapperStyle={{ color: '#94a3b8' }} />
                      {allCategories.map((category) => (
                        <Bar
                          key={category}
                          dataKey={category}
                          fill={categoryColorMap[category]}
                          name={category}
                          stackId="a"
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* 営業担当者サマリーカード */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {salesPersonList.map((person) => {
            const personData = salesData.filter(r => r.sales_person === person)
            const totalSales = personData.reduce((sum, r) => sum + Number(r.total_amount), 0)
            const avgSales = personData.length > 0 ? totalSales / personData.length : 0
            const orderCount = personData.length

            // スパークライン用の日別データ
            const personDailySales = personData.reduce((acc, record) => {
              const date = record.date
              if (!acc[date]) {
                acc[date] = { date, amount: 0 }
              }
              acc[date].amount += Number(record.total_amount)
              return acc
            }, {} as Record<string, { date: string; amount: number }>)

            const sparklineData = Object.values(personDailySales).sort((a, b) => a.date.localeCompare(b.date))

            return (
              <Card
                key={person}
                className="relative overflow-hidden bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-sm cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-2xl border-2"
                style={{ borderColor: salesPersonColors[person] }}
                onClick={() => {
                  setSelectedSalesPerson(person)
                  setIsModalOpen(true)
                }}
              >
                {/* カラフルなアクセントバー */}
                <div
                  className="absolute top-0 left-0 right-0 h-1"
                  style={{ backgroundColor: salesPersonColors[person] }}
                />

                <CardHeader className="pb-3 pt-4">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full animate-pulse"
                      style={{ backgroundColor: salesPersonColors[person] }}
                    />
                    <CardTitle className="text-lg font-bold" style={{ color: salesPersonColors[person] }}>
                      {person}
                    </CardTitle>
                  </div>
                  <CardDescription className="text-slate-400 text-xs mt-1">
                    クリックで詳細表示 →
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-3">
                  <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                    <p className="text-xs text-slate-500 mb-1">総売上</p>
                    <p className="text-2xl font-bold" style={{ color: salesPersonColors[person] }}>
                      ¥{totalSales.toLocaleString()}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-slate-900/30 rounded-lg p-2">
                      <p className="text-xs text-slate-500">平均売上</p>
                      <p className="text-slate-200 font-semibold">¥{Math.round(avgSales).toLocaleString()}</p>
                    </div>
                    <div className="bg-slate-900/30 rounded-lg p-2">
                      <p className="text-xs text-slate-500">受注件数</p>
                      <p className="text-slate-200 font-semibold">{orderCount}件</p>
                    </div>
                  </div>

                  <div className="h-16 bg-slate-900/30 rounded-lg p-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={sparklineData}>
                        <Line
                          type="monotone"
                          dataKey="amount"
                          stroke={salesPersonColors[person]}
                          strokeWidth={2.5}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* データテーブル */}
        <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-slate-200">最新の売上データ</CardTitle>
            <CardDescription className="text-slate-400">直近の取引履歴</CardDescription>
          </CardHeader>
          <CardContent>
            {salesData.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-400 text-lg">データがありません</p>
                <p className="text-slate-500 text-sm mt-2">Googleスプレッドシートからデータを追加してください</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left p-3 text-slate-300 font-semibold">日付</th>
                      <th className="text-left p-3 text-slate-300 font-semibold">顧客名</th>
                      <th className="text-left p-3 text-slate-300 font-semibold">商品名</th>
                      <th className="text-left p-3 text-slate-300 font-semibold">数量</th>
                      <th className="text-left p-3 text-slate-300 font-semibold">単価</th>
                      <th className="text-left p-3 text-slate-300 font-semibold">合計金額</th>
                      <th className="text-left p-3 text-slate-300 font-semibold">担当者</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesData.slice(-10).reverse().map((record) => (
                      <tr key={record.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                        <td className="p-3 text-slate-400">{record.date}</td>
                        <td className="p-3 text-slate-300">{record.customer_name}</td>
                        <td className="p-3 text-slate-300">{record.product_name}</td>
                        <td className="p-3 text-slate-400">{record.quantity}</td>
                        <td className="p-3 text-slate-400">¥{Number(record.unit_price).toLocaleString()}</td>
                        <td className="p-3 text-blue-400 font-semibold">¥{Number(record.total_amount).toLocaleString()}</td>
                        <td className="p-3 text-slate-400">{record.sales_person}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 営業担当者詳細モーダル */}
        <SalesPersonDetailModal
          salesPersonName={selectedSalesPerson}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      </div>
    </div>
  )
}
