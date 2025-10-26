'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { TrendingUp, DollarSign, ShoppingCart, Users } from 'lucide-react'

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

  const chartData = Object.values(dailySales)

  // カテゴリ別売上
  const categorySales = salesData.reduce((acc, record) => {
    const category = record.category || '未分類'
    if (!acc[category]) {
      acc[category] = 0
    }
    acc[category] += Number(record.total_amount)
    return acc
  }, {} as Record<string, number>)

  const categoryChartData = Object.entries(categorySales).map(([category, amount]) => ({
    category,
    amount,
  }))

  // 営業担当者別売上
  const salesPersonSales = salesData.reduce((acc, record) => {
    const salesPerson = record.sales_person
    if (!acc[salesPerson]) {
      acc[salesPerson] = { total: 0, count: 0 }
    }
    acc[salesPerson].total += Number(record.total_amount)
    acc[salesPerson].count += 1
    return acc
  }, {} as Record<string, { total: number; count: number }>)

  const salesPersonChartData = Object.entries(salesPersonSales).map(([name, data]) => ({
    name,
    total: data.total,
    count: data.count,
    average: Math.round(data.total / data.count),
  }))

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
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-violet-400">
            Sales Visualization
          </h1>
          <p className="text-slate-400">営業データをリアルタイムで可視化</p>
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
              <CardTitle className="text-slate-200">日別売上推移</CardTitle>
              <CardDescription className="text-slate-400">時系列での売上変動</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" stroke="#94a3b8" />
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
                  <Line type="monotone" dataKey="amount" stroke="#60a5fa" strokeWidth={2} name="売上金額" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-slate-200">カテゴリ別売上</CardTitle>
              <CardDescription className="text-slate-400">商品カテゴリ別の売上分析</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={categoryChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="category" stroke="#94a3b8" />
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
                  <Bar dataKey="amount" fill="#8b5cf6" name="売上金額" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* 営業担当者別チャート */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-slate-200">営業担当者別売上</CardTitle>
              <CardDescription className="text-slate-400">担当者ごとの売上パフォーマンス</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={salesPersonChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" stroke="#94a3b8" />
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
                  <Bar dataKey="total" fill="#10b981" name="総売上" />
                  <Bar dataKey="count" fill="#f59e0b" name="成約件数" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-slate-200">営業担当者別平均売上</CardTitle>
              <CardDescription className="text-slate-400">1件あたりの平均成約金額</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={salesPersonChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" stroke="#94a3b8" />
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
                  <Bar dataKey="average" fill="#06b6d4" name="平均売上" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
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
      </div>
    </div>
  )
}
