'use client'

import { useEffect, useState } from 'react'
import { Check, ChevronRight } from 'lucide-react'
import { generarPresupuesto, listarParametrosCotizacion, listarPedidos } from '@/app/actions/pedidos'
import { calcularPresupuesto } from '@/lib/pedidos/calculo'
import type { Cotizacion, Order } from '@/lib/pedidos/types'
import { cx } from './cx'
import { PageFrame, Panel } from './PageFrame'

export function OperadorPresupuesto() {
  const [orders, setOrders] = useState<Order[]>([])
  const [order, setOrder] = useState<Order | null>(null)
  const [generated, setGenerated] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [cotizacion, setCotizacion] = useState<Cotizacion | null>(null)
  const [deliveryDate, setDeliveryDate] = useState('')
  const [cantidadMaterial, setCantidadMaterial] = useState('')
  const [tiempoHoras, setTiempoHoras] = useState('')
  const [cantidadLaca, setCantidadLaca] = useState('0')
  const [acetonaCm3, setAcetonaCm3] = useState('0')
  const [totalInput, setTotalInput] = useState<string | null>(null)
  const [today] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  })
  const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 })
  const cantidad = Number(cantidadMaterial.replace(',', '.'))
  const horas = Number(tiempoHoras.replace(',', '.'))
  const lacaPiezas = Number(cantidadLaca.replace(',', '.'))
  const acetona = Number(acetonaCm3.replace(',', '.'))
  const breakdown = cotizacion && cantidad > 0 && horas > 0
    ? calcularPresupuesto(cotizacion, { gramos: cantidad, horas, piezasLaca: lacaPiezas || 0, acetonaCm3: acetona || 0 })
    : null
  const roundedTotal = breakdown ? Math.round(breakdown.total) : 0
  const totalValue = totalInput ?? (roundedTotal ? String(roundedTotal) : '')
  const submittedTotal = Number(totalValue.replace(',', '.'))
  const amountEdited = Boolean(breakdown) && Number.isFinite(submittedTotal) && submittedTotal !== roundedTotal
  const pendingOrders = orders.filter((item) => item.status === 'Pendiente de presupuesto' || item.status === 'En rediseño')

  useEffect(() => {
    void Promise.all([listarPedidos(), listarParametrosCotizacion()]).then(([orderResult, cotizacionResult]) => {
      if (orderResult.ok) setOrders(orderResult.orders)
      else setError(orderResult.error)
      if (cotizacionResult.ok) setCotizacion(cotizacionResult.cotizacion)
      else setError(cotizacionResult.error)
    })
  }, [])

  useEffect(() => {
    setDeliveryDate(order?.estimatedDate ?? '')
    setCantidadMaterial('')
    setTiempoHoras('')
    setCantidadLaca('0')
    setAcetonaCm3('0')
    setTotalInput(null)
    setError('')
  }, [order?.id, order?.estimatedDate])

  const handleQuantityChange = (setter: (value: string) => void, value: string) => {
    if (value === '' || Number(value) >= 0) {
      setter(value)
      setTotalInput(null)
    }
  }

  const handleGenerate = async () => {
    if (!order) return
    if (!/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate)) {
      setError('Cargá la fecha estimada de entrega.')
      return
    }
    if (!(cantidad > 0)) {
      setError('Cargá la cantidad de material.')
      return
    }
    if (!(horas > 0)) {
      setError('Cargá el tiempo de impresión en horas.')
      return
    }
    if (!(submittedTotal > 0)) {
      setError('El monto del presupuesto debe ser mayor a 0.')
      return
    }
    setSaving(true)
    const result = await generarPresupuesto(order.id, {
      fechaEstimada: deliveryDate,
      cantidadMaterial: cantidad,
      tiempoHoras: horas,
      cantidadLaca: lacaPiezas || 0,
      acetonaCm3: acetona || 0,
      total: submittedTotal,
    })
    setSaving(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setOrders((current) => current.map((item) => item.id === result.order.id ? result.order : item))
    setOrder(null)
    setGenerated(true)
  }

  if (generated) {
    return (
      <PageFrame breadcrumb={['Gestión', 'Presupuesto']} eyebrow="OPERACIÓN COMPLETADA" title="Presupuesto enviado" description="El pedido quedó en estado Pendiente de seña.">
        <section className={cx("quote-success")}>
          <div className={cx("success-icon")}><Check /></div>
          <p>El cliente ya puede ver el monto y la fecha estimada de entrega.</p>
        </section>
      </PageFrame>
    )
  }

  return (
    <PageFrame
      breadcrumb={['Gestión', 'Presupuesto']}
      eyebrow="CÁLCULO DE PRESUPUESTO"
      title="Enviar presupuesto"
      description="Cargá gramos, tiempo y consumibles. El total sigue la lógica del cálculo de costos."
    >
      <section className={cx("pending-quotes")}>
        <div>
          <p className={cx("eyebrow")}>PEDIDOS PENDIENTES</p>
          <h3>Elegí qué pedido presupuestar</h3>
        </div>
        {pendingOrders.length === 0 ? (
          <p className={cx("quote-note")}>No hay pedidos pendientes de presupuesto.</p>
        ) : (
          <div className={cx("pending-quotes-list")}>
            {pendingOrders.map((pendingOrder) => (
              <button
                className={cx(`pending-quote-item ${order?.code === pendingOrder.code ? 'pending-quote-item-active' : ''}`)}
                key={pendingOrder.code}
                onClick={() => { setGenerated(false); setOrder(pendingOrder) }}
              >
                <strong>Pedido #{pendingOrder.code}</strong>
                <span>{pendingOrder.product} x{pendingOrder.quantity} · {pendingOrder.customer}</span>
                <ChevronRight />
              </button>
            ))}
          </div>
        )}
      </section>
      {order && (
        <Panel eyebrow="DESGLOSE DEL CÁLCULO" title="Detalle del presupuesto" extra={<span className={cx("quote-status")}>Pendiente</span>}>
          <div className={cx("quote-adjust")}>
            <label className={cx("quote-adjust-field")} htmlFor="quote-material-qty">
              <span>Material usado</span>
              <span className={cx("parameter-input-row")}>
                <input id="quote-material-qty" type="number" min="0.01" step="any" value={cantidadMaterial} onChange={(event) => handleQuantityChange(setCantidadMaterial, event.target.value)} required />
                <span className={cx("parameter-unit")}>gramos</span>
              </span>
              <small>Se multiplica por el precio por gramo de la cotización.</small>
            </label>
            <label className={cx("quote-adjust-field")} htmlFor="quote-print-hours">
              <span>Tiempo de impresión</span>
              <span className={cx("parameter-input-row")}>
                <input id="quote-print-hours" type="number" min="0.01" step="any" value={tiempoHoras} onChange={(event) => handleQuantityChange(setTiempoHoras, event.target.value)} required />
                <span className={cx("parameter-unit")}>horas</span>
              </span>
              <small>Incluye impresión y, si aplica, precalentamiento o ataque químico.</small>
            </label>
            <label className={cx("quote-adjust-field")} htmlFor="quote-laca-qty">
              <span>Piezas con laca</span>
              <input id="quote-laca-qty" type="number" min="0" step="any" value={cantidadLaca} onChange={(event) => handleQuantityChange(setCantidadLaca, event.target.value)} />
              <small>0 si el trabajo no lleva laca.</small>
            </label>
            <label className={cx("quote-adjust-field")} htmlFor="quote-acetona-qty">
              <span>Acetona usada</span>
              <span className={cx("parameter-input-row")}>
                <input id="quote-acetona-qty" type="number" min="0" step="any" value={acetonaCm3} onChange={(event) => handleQuantityChange(setAcetonaCm3, event.target.value)} />
                <span className={cx("parameter-unit")}>cm³</span>
              </span>
              <small>0 si no se usa acetona.</small>
            </label>
          </div>
          <div className={cx("quote-breakdown")}>
            <div><span>Energía <small>({breakdown ? `${breakdown.minutos} min` : '—'})</small></span><strong>{breakdown ? money.format(breakdown.energia) : '—'}</strong></div>
            <div><span>Material <small>({cantidad > 0 ? `${cantidad} g` : '—'})</small></span><strong>{breakdown ? money.format(breakdown.material) : '—'}</strong></div>
            <div><span>Laca</span><strong>{breakdown ? money.format(breakdown.laca) : '—'}</strong></div>
            <div><span>Acetona</span><strong>{breakdown ? money.format(breakdown.acetona) : '—'}</strong></div>
            <div><span>Mantenimiento / reinversión <small>({cotizacion ? `${Math.round(cotizacion.porcentajeMantenimiento * 100)}%` : '—'})</small></span><strong>{breakdown ? money.format(breakdown.mantenimiento) : '—'}</strong></div>
            <div><span>Amortización de impresora</span><strong>{breakdown ? money.format(breakdown.amortizacion) : '—'}</strong></div>
            <div><span>Honorarios</span><strong>{breakdown ? money.format(breakdown.manoObra) : '—'}</strong></div>
            <div><span>Impuestos <small>({cotizacion ? `${Math.round(cotizacion.porcentajeImpuestos * 100)}%` : '—'})</small></span><strong>{breakdown ? money.format(breakdown.impuestos) : '—'}</strong></div>
          </div>
          <div className={cx("quote-adjust")}>
            <label className={cx("quote-adjust-field")} htmlFor="quote-delivery-date">
              <span>Fecha estimada de entrega</span>
              <input id="quote-delivery-date" type="date" value={deliveryDate} min={today} onChange={(event) => setDeliveryDate(event.target.value)} required />
              <small>Se guarda sobre el presupuesto y el pedido.</small>
            </label>
            <label className={cx("quote-adjust-field")} htmlFor="quote-total-amount">
              <span>Monto del presupuesto</span>
              <span className={cx("quote-amount-row")}>
                <span className={cx("parameter-unit")}>ARS</span>
                <input
                  id="quote-total-amount"
                  type="number"
                  min="1"
                  step="1"
                  value={totalValue}
                  onChange={(event) => {
                    const value = event.target.value
                    if (value === '' || Number(value) >= 0) setTotalInput(value)
                  }}
                />
              </span>
              <small>{amountEdited ? `Calculado: ${money.format(roundedTotal)}. Ajustado para este envío.` : 'Podés modificar el monto calculado si corresponde.'}</small>
            </label>
          </div>
          <div className={cx("quote-total")}>
            <span>Total a enviar</span>
            <strong>{Number.isFinite(submittedTotal) && submittedTotal > 0 ? money.format(submittedTotal) : '—'}</strong>
          </div>
          <p className={cx("quote-note")}>Precios base tomados de la cotización{cotizacion?.updated ? ` · ${cotizacion.updated}` : ''}</p>
          {error && <p className={cx("status-confirmation")} role="status">{error}</p>}
          <button className={cx("primary-button quote-generate-button")} onClick={handleGenerate} disabled={saving}>
            {saving ? 'Enviando...' : 'Enviar presupuesto'}
          </button>
        </Panel>
      )}
    </PageFrame>
  )
}
