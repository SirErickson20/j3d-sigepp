'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { generarPresupuesto, listarParametrosCotizacion, listarPedidos, publicarPresupuesto } from '@/app/actions/pedidos'
import { calcularPresupuesto } from '@/lib/pedidos/calculo'
import { requierePresupuesto } from '@/lib/pedidos/estados'
import type { Cotizacion, Order } from '@/lib/pedidos/types'
import { cx } from './cx'
import { PageFrame, Panel } from './PageFrame'

const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 })
const moneyRounded = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

type QuoteStep = 'calcular' | 'publicar' | 'disponible'

// Un pedido "En rediseño" con un presupuesto Disponible necesita uno nuevo: el anterior fue rechazado.
function quoteStep(order: Order): QuoteStep {
  if (!order.quote) return 'calcular'
  if (order.quote.status === 'Generado') return 'publicar'
  return order.status === 'En rediseño' ? 'calcular' : 'disponible'
}

const STEP_TAG: Record<QuoteStep, { label: string; tone: string }> = {
  calcular: { label: 'Sin presupuesto', tone: 'none' },
  publicar: { label: 'Generado', tone: 'generado' },
  disponible: { label: 'Disponible', tone: 'disponible' },
}

function toNumber(value: string) {
  return Number(value.replace(',', '.'))
}

function todayInArgentina() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Jujuy' }).format(new Date())
}

export function OperadorPresupuesto() {
  const [orders, setOrders] = useState<Order[]>([])
  const [cotizacion, setCotizacion] = useState<Cotizacion | null>(null)
  const [loadError, setLoadError] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [published, setPublished] = useState<Order | null>(null)

  useEffect(() => {
    void Promise.all([listarPedidos(), listarParametrosCotizacion()]).then(([orderResult, cotizacionResult]) => {
      if (orderResult.ok) setOrders(orderResult.orders)
      else setLoadError(orderResult.error)
      if (cotizacionResult.ok) setCotizacion(cotizacionResult.cotizacion)
      else setLoadError(cotizacionResult.error)
    })
  }, [])

  const pendingOrders = orders.filter((item) => requierePresupuesto(item.status))
  const order = pendingOrders.find((item) => item.id === selectedId) ?? null
  const replaceOrder = (updated: Order) => setOrders((current) => current.map((item) => item.id === updated.id ? updated : item))

  if (published?.quote) {
    return (
      <PageFrame breadcrumb={['Gestión', 'Presupuesto']} eyebrow="PRESUPUESTO DISPONIBLE" title={`Pedido #${published.code}`} description="El pedido pasó a “Pendiente de seña”.">
        <section className={cx("quote-success")}>
          <div className={cx("success-icon")}><Check /></div>
          <p>El cliente ya puede ver el presupuesto de <strong>{moneyRounded.format(published.quote.total)}</strong> con entrega estimada el <strong>{published.quote.deliveryDateLabel}</strong> consultando su código <strong>#{published.code}</strong>.</p>
          <button className={cx("secondary-button")} type="button" onClick={() => { setPublished(null); setSelectedId(null) }}>
            <ChevronLeft /> Volver a pedidos pendientes
          </button>
        </section>
      </PageFrame>
    )
  }

  return (
    <PageFrame
      breadcrumb={['Gestión', 'Presupuesto']}
      eyebrow="CÁLCULO DE PRESUPUESTO"
      title="Presupuestos"
      description={loadError || 'Calculá el presupuesto de cada pedido y, cuando tenga fecha y monto, dejalo disponible para que el cliente lo consulte con su código.'}
    >
      <section className={cx("quote-orders")}>
        <p className={cx("eyebrow")}>PEDIDOS PENDIENTES</p>
        <h3>Elegí qué pedido presupuestar</h3>
        {pendingOrders.length === 0 ? (
          <p className={cx("quote-note")}>No hay pedidos pendientes de presupuesto.</p>
        ) : (
          <div className={cx("pending-quotes-list")}>
            {pendingOrders.map((pendingOrder) => {
              const tag = STEP_TAG[quoteStep(pendingOrder)]
              return (
                <button
                  className={cx(`pending-quote-item ${order?.id === pendingOrder.id ? 'pending-quote-item-active' : ''}`)}
                  key={pendingOrder.id}
                  type="button"
                  onClick={() => setSelectedId(pendingOrder.id)}
                >
                  <span className={cx("pending-quote-info")}>
                    <strong>Pedido #{pendingOrder.code}</strong>
                    <small>{pendingOrder.product} x{pendingOrder.quantity} · {pendingOrder.customer}{pendingOrder.status === 'En rediseño' ? ' · En rediseño' : ''}</small>
                  </span>
                  <span className={cx(`quote-tag quote-tag-${tag.tone}`)}>{tag.label}</span>
                  <ChevronRight />
                </button>
              )
            })}
          </div>
        )}
      </section>
      {order && (
        <QuoteWorkspace
          key={`${order.id}-${order.quote?.id ?? 'nuevo'}-${order.quote?.status ?? ''}`}
          order={order}
          cotizacion={cotizacion}
          onChange={replaceOrder}
          onPublished={(updated) => { replaceOrder(updated); setPublished(updated) }}
        />
      )}
    </PageFrame>
  )
}

function QuoteWorkspace({ order, cotizacion, onChange, onPublished }: {
  order: Order
  cotizacion: Cotizacion | null
  onChange: (order: Order) => void
  onPublished: (order: Order) => void
}) {
  const step = quoteStep(order)
  const generated = step === 'publicar' ? order.quote : undefined
  const [cantidadMaterial, setCantidadMaterial] = useState(generated ? String(generated.materialGrams) : '')
  const [tiempoHoras, setTiempoHoras] = useState(generated ? String(generated.printHours) : '')
  const [cantidadLaca, setCantidadLaca] = useState(generated ? String(generated.lacquerPieces) : '0')
  const [acetonaCm3, setAcetonaCm3] = useState(generated ? String(generated.acetoneCm3) : '0')
  const [today] = useState(todayInArgentina)
  // Si la fecha precargada ya pasó, se propone hoy: el servidor no acepta entregas en el pasado.
  const [deliveryDate, setDeliveryDate] = useState(() => generated ? (generated.deliveryDate < today ? today : generated.deliveryDate) : '')
  const [totalInput, setTotalInput] = useState(generated ? String(generated.total) : '')
  const [calcError, setCalcError] = useState('')
  const [publishError, setPublishError] = useState('')
  const [saving, setSaving] = useState(false)

  const gramos = toNumber(cantidadMaterial)
  const horas = toNumber(tiempoHoras)
  const piezasLaca = toNumber(cantidadLaca) || 0
  const acetona = toNumber(acetonaCm3) || 0
  const breakdown = cotizacion && gramos > 0 && horas > 0
    ? calcularPresupuesto(cotizacion, { gramos, horas, piezasLaca, acetonaCm3: acetona })
    : null

  // Si el operador cambia los valores después de generar, tiene que volver a calcular antes de publicar.
  const dirty = Boolean(generated) && (
    gramos !== generated?.materialGrams ||
    horas !== generated?.printHours ||
    piezasLaca !== generated?.lacquerPieces ||
    acetona !== generated?.acetoneCm3
  )
  const submittedTotal = toNumber(totalInput)
  const amountEdited = Boolean(generated) && Number.isFinite(submittedTotal) && submittedTotal !== Math.round(generated?.calculatedTotal ?? 0)

  const handleQuantityChange = (setter: (value: string) => void, value: string) => {
    if (value === '' || Number(value) >= 0) setter(value)
  }

  const handleGenerate = async () => {
    if (!(gramos > 0)) return setCalcError('Cargá la cantidad de material en gramos.')
    if (!(horas > 0)) return setCalcError('Cargá el tiempo de impresión en horas.')
    setSaving(true)
    setCalcError('')
    const result = await generarPresupuesto(order.id, { cantidadMaterial: gramos, tiempoHoras: horas, cantidadLaca: piezasLaca, acetonaCm3: acetona })
    setSaving(false)
    if (!result.ok) return setCalcError(result.error)
    onChange(result.order)
  }

  const handlePublish = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate)) return setPublishError('Cargá la fecha estimada de entrega.')
    if (!(submittedTotal > 0)) return setPublishError('El monto del presupuesto debe ser mayor a 0.')
    setSaving(true)
    setPublishError('')
    const result = await publicarPresupuesto(order.id, { fechaEntrega: deliveryDate, total: submittedTotal })
    setSaving(false)
    if (!result.ok) return setPublishError(result.error)
    onPublished(result.order)
  }

  if (step === 'disponible' && order.quote) {
    return (
      <Panel eyebrow="PRESUPUESTO" title={`Pedido #${order.code}`} extra={<span className={cx("quote-tag quote-tag-disponible")}>Disponible</span>}>
        <div className={cx("quote-summary")}>
          <div><span>Monto</span><strong>{moneyRounded.format(order.quote.total)}</strong></div>
          <div><span>Entrega estimada</span><strong>{order.quote.deliveryDateLabel}</strong></div>
        </div>
        <p className={cx("quote-note")}>
          El cliente ya puede verlo con su código. Seguí el pedido desde <Link className={cx("inline-link")} href="/operador">Pedidos</Link>.
        </p>
      </Panel>
    )
  }

  return (
    <div className={cx("quote-steps")}>
      <Panel
        eyebrow="PASO 1 DE 2"
        title="Calcular presupuesto"
        extra={<span className={cx(`quote-tag quote-tag-${generated ? 'generado' : 'none'}`)}>{generated ? 'Generado' : 'Sin generar'}</span>}
      >
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
          <div><span>Material <small>({gramos > 0 ? `${gramos} g` : '—'})</small></span><strong>{breakdown ? money.format(breakdown.material) : '—'}</strong></div>
          <div><span>Laca</span><strong>{breakdown ? money.format(breakdown.laca) : '—'}</strong></div>
          <div><span>Acetona</span><strong>{breakdown ? money.format(breakdown.acetona) : '—'}</strong></div>
          <div><span>Mantenimiento / reinversión <small>({cotizacion ? `${Math.round(cotizacion.porcentajeMantenimiento * 100)}%` : '—'})</small></span><strong>{breakdown ? money.format(breakdown.mantenimiento) : '—'}</strong></div>
          <div><span>Amortización de impresora</span><strong>{breakdown ? money.format(breakdown.amortizacion) : '—'}</strong></div>
          <div><span>Honorarios</span><strong>{breakdown ? money.format(breakdown.manoObra) : '—'}</strong></div>
          <div><span>Impuestos <small>({cotizacion ? `${Math.round(cotizacion.porcentajeImpuestos * 100)}%` : '—'})</small></span><strong>{breakdown ? money.format(breakdown.impuestos) : '—'}</strong></div>
        </div>
        <div className={cx("quote-total")}>
          <span>Total calculado</span>
          <strong>{breakdown ? moneyRounded.format(Math.round(breakdown.total)) : '—'}</strong>
        </div>
        <p className={cx("quote-note")}>Precios base tomados de la cotización{cotizacion?.updated ? ` · ${cotizacion.updated}` : ''}</p>
        {calcError && <p className={cx("status-error")} role="alert">{calcError}</p>}
        <button className={cx(generated && !dirty ? "secondary-button quote-generate-button" : "primary-button quote-generate-button")} type="button" onClick={handleGenerate} disabled={saving}>
          {saving ? 'Guardando...' : generated ? 'Volver a calcular' : 'Generar presupuesto'}
        </button>
      </Panel>

      {generated && (
        <Panel eyebrow="PASO 2 DE 2" title="Fecha de entrega y monto">
          <div className={cx("quote-adjust")}>
            <label className={cx("quote-adjust-field")} htmlFor="quote-delivery-date">
              <span>Fecha estimada de entrega</span>
              <input id="quote-delivery-date" type="date" value={deliveryDate} min={today} onChange={(event) => setDeliveryDate(event.target.value)} required />
              <small>Viene precargada con la fecha estimada del pedido.</small>
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
                  value={totalInput}
                  onChange={(event) => {
                    const value = event.target.value
                    if (value === '' || Number(value) >= 0) setTotalInput(value)
                  }}
                />
              </span>
              <small>{amountEdited ? `Calculado: ${moneyRounded.format(Math.round(generated.calculatedTotal))}. Ajustado a mano.` : 'Podés modificar el monto calculado si corresponde.'}</small>
            </label>
          </div>
          <div className={cx("quote-total")}>
            <span>Total para el cliente</span>
            <strong>{Number.isFinite(submittedTotal) && submittedTotal > 0 ? moneyRounded.format(submittedTotal) : '—'}</strong>
          </div>
          {dirty && <p className={cx("quote-dirty")} role="status">Cambiaste los valores del paso 1. Volvé a calcular antes de dejar el presupuesto disponible.</p>}
          {publishError && <p className={cx("status-error")} role="alert">{publishError}</p>}
          <button className={cx("primary-button quote-generate-button")} type="button" onClick={handlePublish} disabled={saving || dirty}>
            {saving ? 'Guardando...' : 'Dejar disponible para el cliente'}
          </button>
        </Panel>
      )}
    </div>
  )
}
