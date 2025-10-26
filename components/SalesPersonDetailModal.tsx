'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { TrendingUp, DollarSign, ShoppingCart, Target, Mail, Briefcase, Calendar } from 'lucide-react'

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

interface SalesPerson {
  id: string
  name: string
  department: string
  email: string
  monthly_target: number
  quarterly_target: number
  hire_date: string
}

interface SalesPersonDetailModalProps {
  salesPersonName: string | null
  isOpen: boolean
  onClose: () => void
}

const COLORS = ['#60a5fa', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4']

export default function SalesPersonDetailModal({
  salesPersonName,
  isOpen,
  onClose,
}: SalesPersonDetailModalProps) {
  const [salesData, setSalesData] = useState<SalesRecord[]>([])
  const [personInfo, setPersonInfo] = useState<SalesPerson | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (salesPersonName && isOpen) {
      fetchSalesPersonData()
    }
  }, [salesPersonName, isOpen])

  async function fetchSalesPersonData() {
    if (!salesPersonName) return

    setLoading(true)
    try {
      // 営業担当者の基本情報を取得
      const { data: personData, error: personError } = await supabase
        .from('sales_people')
        .select('*')
        .eq('name', salesPersonName)
        .single()

      if (personError) throw personError
      setPersonInfo(personData)

      // 営業担当者の売上データを取得
      const { data: salesRecords, error: salesError } = await supabase
        .from('sales_records')
        .select('*')
        .eq('sales_person', salesPersonName)
        .order('date', { ascending: true })

      if (salesError) throw salesError
      setSalesData(salesRecords || [])
    } catch (error) {
      console.error('Error fetching sales person data:', error)
    } finally {
      setLoading(false)
    }
  }

  // KPI計算
  const totalSales = salesData.reduce((sum, record) => sum + Number(record.total_amount), 0)
  const totalDeals = salesData.length
  const avgDealSize = totalDeals > 0 ? totalSales / totalDeals : 0
  const monthlyAchievementRate = personInfo?.monthly_target
    ? (totalSales / Number(personInfo.monthly_target)) * 100
    : 0

  // 日別売上データ
  const dailySales = salesData.reduce((acc, record) => {
    const date = record.date
    if (!acc[date]) {
      acc[date] = { date, amount: 0 }
    }
    acc[date].amount += Number(record.total_amount)
    return acc
  }, {} as Record<string, { date: string; amount: number }>)

  const dailyChartData = Object.values(dailySales)

  // 顧客別売上
  const customerSales = salesData.reduce((acc, record) => {
    const customer = record.customer_name
    if (!acc[customer]) {
      acc[customer] = 0
    }
    acc[customer] += Number(record.total_amount)
    return acc
  }, {} as Record<string, number>)

  const customerChartData = Object.entries(customerSales)
    .map(([customer, amount]) => ({ customer, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)

  // 商品別売上
  const productSales = salesData.reduce((acc, record) => {
    const product = record.product_name
    if (!acc[product]) {
      acc[product] = 0
    }
    acc[product] += Number(record.total_amount)
    return acc
  }, {} as Record<string, number>)

  const productChartData = Object.entries(productSales)
    .map(([product, amount]) => ({ product, amount }))
    .sort((a, b) => b.amount - a.amount)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-700 text-slate-100">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-violet-400">
            {salesPersonName} - 営業成績詳細
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            個人パフォーマンス分析ダッシュボード
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-slate-300 text-lg">Loading...</div>
          </div>
        ) : (
          <div className="space-y-6 mt-4">
            {/* 基本情報 */}
            {personInfo && (
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-slate-200">担当者情報</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="flex items-center space-x-2">
                      <Briefcase className="h-4 w-4 text-blue-400" />
                      <div>
                        <p className="text-xs text-slate-500">部署</p>
                        <p className="text-sm font-medium text-slate-200">{personInfo.department}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Mail className="h-4 w-4 text-violet-400" />
                      <div>
                        <p className="text-xs text-slate-500">メール</p>
                        <p className="text-sm font-medium text-slate-200">{personInfo.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-emerald-400" />
                      <div>
                        <p className="text-xs text-slate-500">入社日</p>
                        <p className="text-sm font-medium text-slate-200">{personInfo.hire_date}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Target className="h-4 w-4 text-amber-400" />
                      <div>
                        <p className="text-xs text-slate-500">月間目標</p>
                        <p className="text-sm font-medium text-slate-200">
                          ¥{Number(personInfo.monthly_target).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* KPIカード */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-slate-300">総売上</CardTitle>
                  <DollarSign className="h-4 w-4 text-blue-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-400">¥{totalSales.toLocaleString()}</div>
                  <p className="text-xs text-slate-500 mt-1">累計売上金額</p>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-slate-300">成約件数</CardTitle>
                  <ShoppingCart className="h-4 w-4 text-violet-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-violet-400">{totalDeals}</div>
                  <p className="text-xs text-slate-500 mt-1">総成約数</p>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-slate-300">平均成約額</CardTitle>
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-emerald-400">
                    ¥{Math.round(avgDealSize).toLocaleString()}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">1件あたりの平均</p>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-slate-300">目標達成率</CardTitle>
                  <Target className="h-4 w-4 text-amber-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-amber-400">
                    {monthlyAchievementRate.toFixed(1)}%
                  </div>
                  <p className="text-xs text-slate-500 mt-1">月間目標に対して</p>
                </CardContent>
              </Card>
            </div>

            {/* グラフセクション */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 日別売上推移 */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-slate-200">日別売上推移</CardTitle>
                  <CardDescription className="text-slate-400">時系列での売上変動</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={dailyChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                      <YAxis stroke="#94a3b8" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1e293b',
                          border: '1px solid #334155',
                          borderRadius: '8px',
                          color: '#e2e8f0',
                        }}
                      />
                      <Line type="monotone" dataKey="amount" stroke="#60a5fa" strokeWidth={2} name="売上" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* 顧客別売上TOP5 */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-slate-200">顧客別売上 TOP5</CardTitle>
                  <CardDescription className="text-slate-400">主要顧客の売上分析</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={customerChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="customer" stroke="#94a3b8" fontSize={12} />
                      <YAxis stroke="#94a3b8" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1e293b',
                          border: '1px solid #334155',
                          borderRadius: '8px',
                          color: '#e2e8f0',
                        }}
                      />
                      <Bar dataKey="amount" fill="#8b5cf6" name="売上金額" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* 商品別売上分布 */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-slate-200">商品別売上分布</CardTitle>
                  <CardDescription className="text-slate-400">取扱商品の構成比</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={productChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ product, percent }) => `${product} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="amount"
                      >
                        {productChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1e293b',
                          border: '1px solid #334155',
                          borderRadius: '8px',
                          color: '#e2e8f0',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* 商品別売上ランキング */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-slate-200">商品別売上ランキング</CardTitle>
                  <CardDescription className="text-slate-400">商品別の売上詳細</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={productChartData} layout="horizontal">
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis type="number" stroke="#94a3b8" fontSize={12} />
                      <YAxis dataKey="product" type="category" stroke="#94a3b8" fontSize={12} width={100} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1e293b',
                          border: '1px solid #334155',
                          borderRadius: '8px',
                          color: '#e2e8f0',
                        }}
                      />
                      <Bar dataKey="amount" fill="#10b981" name="売上金額" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* 取引履歴テーブル */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-slate-200">取引履歴</CardTitle>
                <CardDescription className="text-slate-400">全ての取引記録</CardDescription>
              </CardHeader>
              <CardContent>
                {salesData.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-slate-400">データがありません</p>
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
                        </tr>
                      </thead>
                      <tbody>
                        {salesData.map((record) => (
                          <tr
                            key={record.id}
                            className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors"
                          >
                            <td className="p-3 text-slate-400">{record.date}</td>
                            <td className="p-3 text-slate-300">{record.customer_name}</td>
                            <td className="p-3 text-slate-300">{record.product_name}</td>
                            <td className="p-3 text-slate-400">{record.quantity}</td>
                            <td className="p-3 text-slate-400">¥{Number(record.unit_price).toLocaleString()}</td>
                            <td className="p-3 text-blue-400 font-semibold">
                              ¥{Number(record.total_amount).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
