'use client'

import { useEffect, useMemo, useState } from 'react'
import { listarPedidos } from '@/app/actions/pedidos'
import type { Order } from '@/lib/pedidos/types'
import { cx } from './cx'
import { PageFrame, Panel } from './PageFrame'

type Period = 'Últimos 7 días' | 'Últimos 30 días' | 'Este mes' | 'Personalizado'
const PERIODS: Period[] = ['Últimos 7 días', 'Últimos 30 días', 'Este mes', 'Personalizado']
const DAY_MS = 24 * 60 * 60 * 1000

const dateLabel = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
const percentLabel = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 })

// Fecha local (YYYY-MM-DD) para los campos de tipo date.
function toInputDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// Rango [desde, hasta) en hora local según el período elegido.
function periodRange(period: Period, now: number, from: string, to: string): { start: Date; end: Date } | { error: string } {
  const today = new Date(now)
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const startOfTomorrow = new Date(startOfToday.getTime() + DAY_MS)
  if (period === 'Últimos 7 días') return { start: new Date(startOfTomorrow.getTime() - 7 * DAY_MS), end: startOfTomorrow }
  if (period === 'Últimos 30 días') return { start: new Date(startOfTomorrow.getTime() - 30 * DAY_MS), end: startOfTomorrow }
  if (period === 'Este mes') return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: startOfTomorrow }

  if (!from || !to) return { error: 'Elegí las fechas "Desde" y "Hasta" para ver el reporte.' }
  if (from > to) return { error: 'La fecha "Desde" no puede ser posterior a "Hasta".' }
  const [fy, fm, fd] = from.split('-').map(Number)
  const [ty, tm, td] = to.split('-').map(Number)
  return { start: new Date(fy, fm - 1, fd), end: new Date(ty, tm - 1, td + 1) }
}

export function OperadorReportes() {
  const [orders, setOrders] = useState<Order[]>([])
  const [error, setError] = useState('')
  const [period, setPeriod] = useState<Period>('Últimos 30 días')
  const [sortBy, setSortBy] = useState<'quantity' | 'product'>('quantity')
  const [now] = useState(Date.now)
  const [from, setFrom] = useState(() => { const d = new Date(now); return toInputDate(new Date(d.getFullYear(), d.getMonth(), 1)) })
  const [to, setTo] = useState(() => toInputDate(new Date(now)))

  useEffect(() => {
    void listarPedidos().then((result) => {
      if (result.ok) setOrders(result.orders)
      else setError(result.error)
    })
  }, [])

  const range = useMemo(() => periodRange(period, now, from, to), [period, now, from, to])

  const reportData = useMemo(() => {
    if ('error' in range) return null
    const filtered = orders.filter((order) => {
      const created = new Date(order.createdAt).getTime()
      return created >= range.start.getTime() && created < range.end.getTime()
    })
    const counts = filtered.reduce<Record<string, number>>((result, order) => {
      result[order.product] = (result[order.product] ?? 0) + 1
      return result
    }, {})
    const byQuantity = Object.entries(counts)
      .map(([product, quantity]) => ({ product, quantity, percentage: (quantity / filtered.length) * 100 }))
      .sort((a, b) => b.quantity - a.quantity || a.product.localeCompare(b.product))
    return { total: filtered.length, byQuantity }
  }, [orders, range])

  const tableRows = reportData
    ? sortBy === 'product' ? [...reportData.byQuantity].sort((a, b) => a.product.localeCompare(b.product)) : reportData.byQuantity
    : []
  const maxQuantity = reportData?.byQuantity[0]?.quantity ?? 0
  const rangeLabel = 'error' in range
    ? ''
    : `Del ${dateLabel.format(range.start)} al ${dateLabel.format(new Date(range.end.getTime() - DAY_MS))}`

  return (
    <PageFrame
      breadcrumb={['Gestión', 'Reportes']}
      eyebrow="ANÁLISIS OPERATIVO"
      title="Reporte de pedidos por tipo de producto"
      description={error || 'Identificá tendencias de demanda para tomar decisiones sobre el catálogo y la producción.'}
      actions={
        <div className={cx("period-filter")}>
          <label htmlFor="report-period">PERÍODO</label>
          <select id="report-period" value={period} onChange={(event) => setPeriod(event.target.value as Period)}>
            {PERIODS.map((item) => <option key={item}>{item}</option>)}
          </select>
          {period === 'Personalizado' && (
            <div className={cx("custom-dates")}>
              <input id="report-from" type="date" aria-label="Desde" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} />
              <input id="report-to" type="date" aria-label="Hasta" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} />
            </div>
          )}
          {rangeLabel && <p className={cx("period-range")}>{rangeLabel}</p>}
        </div>
      }
    >
      {'error' in range ? (
        <div className={cx("report-empty")} role="alert">{range.error}</div>
      ) : !reportData || reportData.total === 0 ? (
        <div className={cx("report-empty")}>No hay pedidos registrados en este período</div>
      ) : (
        <>
          <Panel eyebrow="VISTA GRÁFICA" title="Pedidos por producto" extra={<span className={cx("report-total")}>{reportData.total} {reportData.total === 1 ? 'pedido' : 'pedidos'}</span>}>
            <div className={cx("chart-scroll")}>
              <div className={cx("horizontal-chart")} aria-label="Gráfico de pedidos por tipo de producto, de mayor a menor">
                {reportData.byQuantity.map((item) => (
                  <div className={cx("chart-row")} key={item.product}>
                    <span className={cx("chart-label")}>{item.product}</span>
                    <div className={cx("chart-track")}>
                      <div className={cx(`chart-bar ${item.quantity === maxQuantity ? 'chart-bar-highlight' : ''}`)} style={{ width: `${maxQuantity ? (item.quantity / maxQuantity) * 100 : 0}%` }} />
                    </div>
                    <strong>{item.quantity}</strong>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
          <Panel eyebrow="DETALLE" title="Distribución del total" extra={<span className={cx("report-total")}>{sortBy === 'quantity' ? 'Ordenado por cantidad' : 'Ordenado por tipo de producto'}</span>}>
            <div className={cx("report-table")}>
              <div className={cx("report-table-head")}>
                <button type="button" aria-pressed={sortBy === 'product'} onClick={() => setSortBy('product')}>Tipo de producto{sortBy === 'product' ? ' ↓' : ''}</button>
                <button type="button" aria-pressed={sortBy === 'quantity'} onClick={() => setSortBy('quantity')}>Cantidad de pedidos{sortBy === 'quantity' ? ' ↓' : ''}</button>
                <span>% del total</span>
              </div>
              {tableRows.map((item) => (
                <div className={cx("report-table-row")} key={item.product}>
                  <strong>{item.product}</strong>
                  <span><b>{item.quantity}</b> {item.quantity === 1 ? 'pedido' : 'pedidos'}</span>
                  <span>{percentLabel.format(item.percentage)}%</span>
                </div>
              ))}
            </div>
          </Panel>
        </>
      )}
    </PageFrame>
  )
}
