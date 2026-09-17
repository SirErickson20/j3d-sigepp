'use client'

import { useEffect, useMemo, useState } from 'react'
import { listarPedidos } from '@/app/actions/pedidos'
import type { Order } from '@/lib/pedidos/types'
import { cx } from './cx'
import { PageFrame, Panel } from './PageFrame'

export function OperadorReportes() {
  const [orders, setOrders] = useState<Order[]>([])
  const [error, setError] = useState('')
  const [period, setPeriod] = useState('Últimos 30 días')
  const [sortBy, setSortBy] = useState<'quantity' | 'product'>('quantity')
  const [now] = useState(Date.now)

  useEffect(() => {
    void listarPedidos().then((result) => {
      if (result.ok) setOrders(result.orders)
      else setError(result.error)
    })
  }, [])

  const reportData = useMemo(() => {
    const filtered = orders.filter((order) => {
      const created = new Date(order.createdAt).getTime()
      if (period === 'Últimos 7 días') return now - created <= 7 * 24 * 60 * 60 * 1000
      if (period === 'Últimos 30 días') return now - created <= 30 * 24 * 60 * 60 * 1000
      if (period === 'Este mes') {
        const date = new Date(order.createdAt)
        const today = new Date()
        return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear()
      }
      return true
    })
    const counts = filtered.reduce<Record<string, number>>((result, order) => {
      result[order.product] = (result[order.product] ?? 0) + 1
      return result
    }, {})
    const total = filtered.length || 1
    return {
      total: filtered.length,
      rows: Object.entries(counts).map(([product, quantity]) => ({ product, quantity, percentage: Math.round((quantity / total) * 100) })).sort((a, b) => sortBy === 'product' ? a.product.localeCompare(b.product) : b.quantity - a.quantity),
    }
  }, [now, orders, period, sortBy])
  const maxQuantity = Math.max(...reportData.rows.map((item) => item.quantity), 0)

  return (
    <PageFrame
      breadcrumb={['Gestión', 'Reportes']}
      eyebrow="ANÁLISIS OPERATIVO"
      title="Reporte de pedidos por tipo de producto"
      description={error || 'Identificá tendencias de demanda para tomar decisiones sobre el catálogo y la producción.'}
      actions={
        <div className={cx("period-filter")}>
          <label htmlFor="report-period">PERÍODO</label>
          <select id="report-period" value={period} onChange={(event) => setPeriod(event.target.value)}>
            <option>Últimos 7 días</option>
            <option>Últimos 30 días</option>
            <option>Este mes</option>
            <option>Personalizado</option>
          </select>
          {period === 'Personalizado' && (
            <div className={cx("custom-dates")}>
              <input type="date" aria-label="Desde" />
              <input type="date" aria-label="Hasta" />
            </div>
          )}
        </div>
      }
    >
      {reportData.total === 0 ? (
        <div className={cx("report-empty")}>No hay pedidos registrados en este período</div>
      ) : (
        <>
          <Panel eyebrow="VISTA GRÁFICA" title="Pedidos por producto" extra={<span className={cx("report-total")}>{reportData.total} pedidos</span>}>
            <div className={cx("chart-scroll")}>
              <div className={cx("horizontal-chart")} aria-label="Gráfico de pedidos por tipo de producto">
                {reportData.rows.map((item, index) => (
                  <div className={cx("chart-row")} key={item.product}>
                    <span className={cx("chart-label")}>{item.product}</span>
                    <div className={cx("chart-track")}>
                      <div className={cx(`chart-bar ${index === 0 ? 'chart-bar-highlight' : ''}`)} style={{ width: `${maxQuantity ? (item.quantity / maxQuantity) * 100 : 0}%` }} />
                    </div>
                    <strong>{item.quantity}</strong>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
          <Panel eyebrow="DETALLE" title="Distribución del total" extra={<span className={cx("report-total")}>Ordenado por cantidad</span>}>
            <div className={cx("report-table")}>
              <div className={cx("report-table-head")}>
                <button onClick={() => setSortBy('product')}>Tipo de producto</button>
                <button onClick={() => setSortBy('quantity')}>Cantidad de pedidos</button>
                <span>% del total</span>
              </div>
              {reportData.rows.map((item) => (
                <div className={cx("report-table-row")} key={item.product}>
                  <strong>{item.product}</strong>
                  <span><b>{item.quantity}</b> pedidos</span>
                  <span>{item.percentage}%</span>
                </div>
              ))}
            </div>
          </Panel>
        </>
      )}
    </PageFrame>
  )
}
