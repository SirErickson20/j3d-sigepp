'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, FileText, Package, Truck } from 'lucide-react'
import { actualizarEstadoPedido, listarPedidos } from '@/app/actions/pedidos'
import { ORDER_STATUSES, type Filter, type Order, type OrderStatus } from '@/lib/pedidos/types'
import { cx } from './cx'
import { PageFrame, Panel } from './PageFrame'

const filters: Filter[] = ['Todos', ...ORDER_STATUSES]

function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={cx(`status status-${status.toLowerCase().replaceAll(' ', '-')}`)}><span className={cx("status-dot")} />{status}</span>
}

function nextOrderStatus(status: OrderStatus): OrderStatus | undefined {
  if (status === "Pendiente de presupuesto") return "Pendiente de seña"
  const currentIndex = ORDER_STATUSES.indexOf(status)
  return ORDER_STATUSES[currentIndex + 1]
}

function OrderDetail({ order, onBack, onUpdate }: { order: Order; onBack: () => void; onUpdate: (status: OrderStatus) => Promise<void> }) {
  const currentIndex = ORDER_STATUSES.indexOf(order.status)
  const nextStatus = nextOrderStatus(order.status)
  const [pendingStatus, setPendingStatus] = useState<OrderStatus | ''>('')
  const [confirmation, setConfirmation] = useState('')
  const [saving, setSaving] = useState(false)

  const handleUpdate = async () => {
    if (!pendingStatus) return
    setSaving(true)
    await onUpdate(pendingStatus)
    setSaving(false)
    setConfirmation(`Estado actualizado a: ${pendingStatus}`)
    setPendingStatus('')
  }

  return (
    <PageFrame breadcrumb={['Gestión', 'Pedidos', `#${order.code}`]} eyebrow="DETALLE DEL PEDIDO" title={`Pedido #${order.code}`} description="Trazabilidad y seguimiento del proceso productivo.">
      <button className={cx("back-button")} onClick={onBack}><ChevronLeft /> Volver al listado</button>
      <Panel eyebrow="INFORMACIÓN" title="Datos del pedido" extra={<StatusBadge status={order.status} />}>
        <div className={cx("detail-info-grid")}>
          <div><span className={cx("label")}>CLIENTE</span><strong>{order.customer}</strong></div>
          <div><span className={cx("label")}>CORREO</span><strong>{order.email}</strong></div>
          <div><span className={cx("label")}>TELÉFONO</span><strong>{order.phone}</strong></div>
          <div><span className={cx("label")}>TIPO DE PRODUCTO</span><strong>{order.product}</strong></div>
          <div className={cx("detail-info-wide")}><span className={cx("label")}>COLORES</span><div className={cx("color-list")}>{order.colors.map((color) => <span className={cx(`color-chip color-${color.toLowerCase()}`)} key={color}><span className={cx("color-swatch")} />{color}</span>)}</div></div>
          <div><span className={cx("label")}>CANTIDAD</span><strong>{order.quantity} unidades</strong></div>
          <div className={cx("detail-info-wide")}><span className={cx("label")}>DISEÑO REQUERIDO</span><strong>{order.designDescription}</strong></div>
          <div className={cx("detail-info-wide")}>
            <span className={cx("label")}>ARCHIVO DE REFERENCIA <small>(OPCIONAL)</small></span>
            {order.referenceUrl ? <a className={cx("file-upload")} href={order.referenceUrl} target="_blank" rel="noreferrer"><FileText />{order.referenceFile}</a> : <span className={cx("file-upload")}><FileText />{order.referenceFile ?? 'Sin archivo cargado'}</span>}
            {order.referenceFile && <span className={cx("file-name")}>Archivo cargado: {order.referenceFile}</span>}
          </div>
          <div className={cx("delivery-summary")}><span className={cx("label")}>MODALIDAD DE ENTREGA</span><strong>{order.delivery}</strong></div>
          <div className={cx("delivery-summary")}><span className={cx("label")}>FECHA ESTIMADA</span><strong>{order.date}</strong></div>
          {order.delivery === 'Envío' && <div className={cx("delivery-address detail-info-wide")}><span className={cx("label")}>DOMICILIO DE ENTREGA</span><strong>{order.address}</strong><span className={cx("address-meta")}>{order.city} · Código postal {order.postalCode}</span></div>}
        </div>
      </Panel>
      <Panel eyebrow="SEGUIMIENTO" title="Estado del pedido" extra={<span className={cx("stage-count")}>Etapa {currentIndex + 1} de {ORDER_STATUSES.length}</span>}>
        <div className={cx("status-stepper")}>{ORDER_STATUSES.map((stage, index) => <div className={cx(`step ${index === currentIndex ? 'step-current' : ''} ${index < currentIndex ? 'step-complete' : ''}`)} key={stage}><div className={cx("step-badge")}>{index < currentIndex ? <Check /> : <span>{index + 1}</span>}</div><span>{stage}</span>{index < ORDER_STATUSES.length - 1 && <div className={cx("step-line")} />}</div>)}</div>
        <div className={cx("status-actions")}>{confirmation && <p className={cx("status-confirmation")} role="status">{confirmation}</p>}{nextStatus ? <><label htmlFor="next-status">Próxima etapa</label><div className={cx("status-update-row")}><select id="next-status" value={pendingStatus} onChange={(event) => setPendingStatus(event.target.value as OrderStatus)}><option value="">Seleccionar próxima etapa</option><option value={nextStatus}>{nextStatus}</option></select><button className={cx("primary-button")} disabled={!pendingStatus || saving} onClick={handleUpdate}>{saving ? 'Guardando...' : 'Actualizar estado'}</button></div></> : <p className={cx("completed-note")}>Este pedido ya fue entregado.</p>}</div>
      </Panel>
    </PageFrame>
  )
}

export function OperadorPedidos() {
  const [orders, setOrders] = useState<Order[]>([])
  const [error, setError] = useState('')
  const [activeFilter, setActiveFilter] = useState<Filter>('Todos')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

  useEffect(() => {
    void listarPedidos().then((orderResult) => {
      if (!orderResult.ok) {
        setError(orderResult.error)
        return
      }
      setOrders(orderResult.orders)
    })
  }, [])

  const visibleOrders = useMemo(() => activeFilter === 'Todos' ? orders : orders.filter((order) => order.status === activeFilter), [activeFilter, orders])

  const updateOrderStatus = async (status: OrderStatus) => {
    if (!selectedOrder) return
    const result = await actualizarEstadoPedido(selectedOrder.id, status)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setSelectedOrder(result.order)
    setOrders((current) => current.map((order) => order.id === result.order.id ? result.order : order))
  }

  if (selectedOrder) {
    return <OrderDetail order={selectedOrder} onBack={() => setSelectedOrder(null)} onUpdate={updateOrderStatus} />
  }

  return (
    <PageFrame breadcrumb={['Gestión', 'Pedidos']} eyebrow="OPERACIONES" title="Pedidos ingresados" description={error || 'Gestioná y seguí todos los pedidos personalizados de tu tienda.'}>
      <section className={cx("orders-section")} aria-label="Listado de pedidos">
        <div className={cx("filter-row")} role="group" aria-label="Filtrar pedidos">
          {filters.map((filter) => (
            <button key={filter} className={cx(`filter-chip ${activeFilter === filter ? 'filter-chip-active' : ''}`)} onClick={() => setActiveFilter(filter)}>
              {filter}
              {filter !== 'Todos' && <span className={cx("filter-count")}>{orders.filter((order) => order.status === filter).length}</span>}
            </button>
          ))}
        </div>
        <div className={cx("orders-list")}>
          {visibleOrders.length === 0 ? (
            <div className={cx("empty-state")}>
              <div className={cx("empty-icon")}><Package /></div>
              <h2>Todavía no hay pedidos personalizados cargados</h2>
              <p>Los nuevos pedidos aparecerán en este listado.</p>
            </div>
          ) : visibleOrders.map((order) => (
            <button className={cx("order-row")} key={order.id} onClick={() => setSelectedOrder(order)}>
              <div className={cx("order-main")}>
                <div className={cx("order-code")}>#{order.code}</div>
                <div className={cx("order-customer")}>{order.customer}</div>
              </div>
              <div className={cx("order-product")}><span className={cx("label")}>PRODUCTO</span><strong>{order.product}</strong><span className={cx("quantity")}>x{order.quantity}</span></div>
              <div className={cx("order-delivery")}><span className={cx("label")}>ENTREGA</span><span className={cx("delivery-value")}>{order.delivery === 'Envío' ? <Truck /> : <Package />}{order.delivery}</span></div>
              <div className={cx("order-date")}><span className={cx("label")}>FECHA ESTIMADA</span><strong>{order.date}</strong></div>
              <StatusBadge status={order.status} />
              <ChevronRight className={cx("row-arrow")} />
            </button>
          ))}
        </div>
      </section>
    </PageFrame>
  )
}
