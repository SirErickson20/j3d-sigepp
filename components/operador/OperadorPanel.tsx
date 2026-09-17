'use client'

import styles from './operador.module.css'
import { useMemo, useState } from 'react'
import { BarChart3, Check, ChevronLeft, ChevronRight, ClipboardList, FileText, Menu, Package, Save, SlidersHorizontal, Truck, X } from 'lucide-react'

function cx(...values: Array<string | false | null | undefined>) {
  return values
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => value.split(" "))
    .map((className) => styles[className] ?? className)
    .join(" ")
}

type OrderStatus = 'Pendiente de presupuesto' | 'En rediseño' | 'Pendiente de seña' | 'En producción' | 'Finalizado' | 'Pendiente de saldo' | 'Entregado'
type Filter = 'Todos' | OrderStatus

type Color = 'Rojo' | 'Azul' | 'Amarillo' | 'Verde' | 'Naranja' | 'Violeta' | 'Blanco' | 'Negro' | 'Otros'

type Order = {
  code: string
  customer: string
  email: string
  phone: string
  address?: string
  city?: string
  postalCode?: string
  product: 'Mate' | 'Llavero' | 'Medalla' | 'Vaso' | 'Juguete' | 'Maceta' | 'Soporte' | 'Otros'
  colors: Color[]
  quantity: number
  designDescription: string
  referenceFile?: string
  delivery: 'Retiro' | 'Envío'
  date: string
  status: OrderStatus
}

const orders: Order[] = [
  { code: '#A4521', customer: 'Sofía Martínez', email: 'sofia.martinez@email.com', phone: '+54 9 11 4567-8901', product: 'Mate', colors: ['Rojo'], quantity: 3, designDescription: 'Logo frontal en tamaño mediano.', referenceFile: 'logo-sofia.png', delivery: 'Retiro', date: '12 oct 2026', status: 'Pendiente de presupuesto' },
  { code: '#A4524', customer: 'Julián Pérez', email: 'julian.perez@email.com', phone: '+54 9 11 4567-8908', address: 'Laprida 560', city: 'La Plata', postalCode: 'B1900', product: 'Maceta', colors: ['Verde', 'Blanco'], quantity: 4, designDescription: 'Maceta con nombre personalizado en el frente.', delivery: 'Envío', date: '16 oct 2026', status: 'Pendiente de presupuesto' },
  { code: '#A4518', customer: 'Tomás González', email: 'tomas.gonzalez@email.com', phone: '+54 9 11 4567-8902', address: 'Av. Corrientes 1450', city: 'CABA', postalCode: 'C1042', product: 'Llavero', colors: ['Azul', 'Blanco'], quantity: 12, designDescription: 'Identidad visual para evento corporativo.', delivery: 'Envío', date: '14 oct 2026', status: 'En rediseño' },
  { code: '#A4512', customer: 'Valentina Ríos', email: 'valentina.rios@email.com', phone: '+54 9 11 4567-8903', product: 'Medalla', colors: ['Amarillo'], quantity: 5, designDescription: 'Medalla con texto personalizado.', delivery: 'Retiro', date: '10 oct 2026', status: 'Pendiente de seña' },
  { code: '#A4509', customer: 'Martín Acosta', email: 'martin.acosta@email.com', phone: '+54 9 11 4567-8904', address: 'San Martín 820', city: 'Rosario', postalCode: 'S2000', product: 'Vaso', colors: ['Verde'], quantity: 2, designDescription: 'Ilustración botánica alrededor del vaso.', referenceFile: 'referencia-martin.pdf', delivery: 'Envío', date: '18 oct 2026', status: 'En producción' },
  { code: '#A4501', customer: 'Lucía Fernández', email: 'lucia.fernandez@email.com', phone: '+54 9 11 4567-8905', address: 'Belgrano 221', city: 'Córdoba', postalCode: 'X5000', product: 'Juguete', colors: ['Naranja', 'Violeta'], quantity: 20, designDescription: 'Personaje infantil con detalles simples.', delivery: 'Envío', date: '09 oct 2026', status: 'Finalizado' },
  { code: '#A4498', customer: 'Diego Sosa', email: 'diego.sosa@email.com', phone: '+54 9 11 4567-8906', product: 'Maceta', colors: ['Negro'], quantity: 1, designDescription: 'Maceta geométrica de acabado mate.', delivery: 'Retiro', date: '20 oct 2026', status: 'Pendiente de saldo' },
  { code: '#A4491', customer: 'Camila Torres', email: 'camila.torres@email.com', phone: '+54 9 11 4567-8907', address: 'Mitre 430', city: 'Mendoza', postalCode: 'M5500', product: 'Soporte', colors: ['Otros'], quantity: 8, designDescription: 'Soporte personalizado según medidas acordadas.', delivery: 'Envío', date: '07 oct 2026', status: 'Entregado' },
]

const filters: Filter[] = ['Todos', 'Pendiente de presupuesto', 'En rediseño', 'Pendiente de seña', 'En producción', 'Finalizado', 'Pendiente de saldo', 'Entregado']

function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={cx(`status status-${status.toLowerCase().replaceAll(' ', '-')}`)}><span className={cx("status-dot")} />{status}</span>
}

function OrderDetail({ order, onBack, onUpdate }: { order: Order; onBack: () => void; onUpdate: (status: OrderStatus) => void }) {
  const stages: OrderStatus[] = ['Pendiente de presupuesto', 'En rediseño', 'Pendiente de seña', 'En producción', 'Finalizado', 'Pendiente de saldo', 'Entregado']
  const currentIndex = stages.indexOf(order.status)
  const nextStatus = stages[currentIndex + 1]
  const [pendingStatus, setPendingStatus] = useState<OrderStatus | ''>('')
  const [confirmation, setConfirmation] = useState('')
  const handleUpdate = () => { if (pendingStatus) { onUpdate(pendingStatus); setConfirmation(`Estado actualizado a: ${pendingStatus}`); setPendingStatus('') } }

  return <main className={cx("main-content detail-page")} id="detalle-pedido">
    <header className={cx("topbar")}><div className={cx("breadcrumb")}>Gestión <span>/</span> Pedidos <span>/</span> {order.code}</div><div className={cx("topbar-actions")}><div className={cx("topbar-avatar")}>OP</div></div></header>
    <section className={cx("detail-header")}><button className={cx("back-button")} onClick={onBack}><ChevronLeft /> Volver al listado</button><p className={cx("eyebrow")}>DETALLE DEL PEDIDO</p><h1>Pedido {order.code}</h1><p className={cx("page-description")}>Trazabilidad y seguimiento del proceso productivo.</p></section>
    <section className={cx("detail-card order-info-card")}><div className={cx("detail-card-heading")}><div><p className={cx("eyebrow")}>INFORMACIÓN</p><h2>Datos del pedido</h2></div><StatusBadge status={order.status} /></div><div className={cx("detail-info-grid")}><div><span className={cx("label")}>CLIENTE</span><strong>{order.customer}</strong></div><div><span className={cx("label")}>CORREO</span><strong>{order.email}</strong></div><div><span className={cx("label")}>TELÉFONO</span><strong>{order.phone}</strong></div><div><span className={cx("label")}>TIPO DE PRODUCTO</span><strong>{order.product}</strong></div><div className={cx("detail-info-wide")}><span className={cx("label")}>COLORES</span><div className={cx("color-list")}>{order.colors.map((color) => <span className={cx(`color-chip color-${color.toLowerCase()}`)} key={color}><span className={cx("color-swatch")} />{color}</span>)}</div></div><div><span className={cx("label")}>CANTIDAD</span><strong>{order.quantity} unidades</strong></div><div className={cx("detail-info-wide")}><span className={cx("label")}>DISEÑO REQUERIDO</span><strong>{order.designDescription}</strong></div><div className={cx("detail-info-wide")}><span className={cx("label")}>ARCHIVO DE REFERENCIA <small>(OPCIONAL)</small></span><label className={cx("file-upload")}><FileText />{order.referenceFile ?? 'Cargar archivo .jpg, .jpeg, .png o .pdf'}<input type="file" accept=".jpg,.jpeg,.png,.pdf" /></label>{order.referenceFile && <span className={cx("file-name")}>Archivo cargado: {order.referenceFile}</span>}</div><div className={cx("delivery-summary")}><span className={cx("label")}>MODALIDAD DE ENTREGA</span><strong>{order.delivery}</strong></div><div className={cx("delivery-summary")}><span className={cx("label")}>FECHA ESTIMADA</span><strong>{order.date}</strong></div>{order.delivery === 'Envío' && <div className={cx("delivery-address detail-info-wide")}><span className={cx("label")}>DOMICILIO DE ENTREGA</span><strong>{order.address}</strong><span className={cx("address-meta")}>{order.city} · Código postal {order.postalCode}</span></div>}</div></section>
    <section className={cx("detail-card status-card")}><div className={cx("detail-card-heading")}><div><p className={cx("eyebrow")}>SEGUIMIENTO</p><h2>Estado del pedido</h2></div><span className={cx("stage-count")}>Etapa {currentIndex + 1} de {stages.length}</span></div><div className={cx("status-stepper")}>{stages.map((stage, index) => <div className={cx(`step ${index === currentIndex ? 'step-current' : ''} ${index < currentIndex ? 'step-complete' : ''}`)} key={stage}><div className={cx("step-badge")}>{index < currentIndex ? <Check /> : <span>{index + 1}</span>}</div><span>{stage}</span>{index < stages.length - 1 && <div className={cx("step-line")} />}</div>)}    </div><div className={cx("status-actions")}>{confirmation && <p className={cx("status-confirmation")} role="status">{confirmation}</p>}{nextStatus ? <><label htmlFor="next-status">Próxima etapa</label><div className={cx("status-update-row")}><select id="next-status" value={pendingStatus} onChange={(event) => setPendingStatus(event.target.value as OrderStatus)}><option value="">Seleccionar próxima etapa</option><option value={nextStatus}>{nextStatus}</option></select><button className={cx("primary-button")} disabled={!pendingStatus} onClick={handleUpdate}>Actualizar estado</button></div></> : <p className={cx("completed-note")}>Este pedido ya fue entregado.</p>}</div></section>
  </main>
}

type QuoteParameter = { label: string; unit: string; value: string; placeholder: string; updated: string }

function QuoteParameters({ onBack }: { onBack: () => void }) {
  const [parameters, setParameters] = useState<QuoteParameter[]>([
    { label: 'Precio de material', unit: 'por unidad', value: '850', placeholder: 'Ingresá el valor', updated: '15 sep 2026' },
    { label: 'Tiempo estimado de impresión', unit: 'en horas', value: '2.5', placeholder: 'Ingresá el valor', updated: '15 sep 2026' },
    { label: 'Costo de electricidad', unit: 'por hora de uso', value: '120', placeholder: 'Ingresá el valor', updated: '15 sep 2026' },
    { label: 'Desgaste de máquina', unit: 'por hora', value: '350', placeholder: 'Ingresá el valor', updated: '15 sep 2026' },
    { label: 'Costo de mano de obra', unit: 'por hora', value: '2400', placeholder: 'Ingresá el valor', updated: '15 sep 2026' },
  ])
  const [confirmation, setConfirmation] = useState('')
  const handleValueChange = (index: number, value: string) => { if (value === '' || Number(value) > 0) setParameters((current) => current.map((parameter, parameterIndex) => parameterIndex === index ? { ...parameter, value } : parameter)) }
  const handleSave = () => setConfirmation('Parámetros actualizados correctamente')

  return <main className={cx("main-content settings-page")}>
    <header className={cx("topbar")}><div className={cx("breadcrumb")}>Gestión <span>/</span> Cotización</div><div className={cx("topbar-actions")}><div className={cx("topbar-avatar")}>OP</div></div></header>
    <section className={cx("settings-header")}><button className={cx("back-button")} onClick={onBack}><ChevronLeft /> Volver a pedidos</button><p className={cx("eyebrow")}>CONFIGURACIÓN</p><h1>Parámetros de cotización</h1><p className={cx("page-description")}>Estos valores se usan como base para calcular cualquier presupuesto.</p></section>
    <section className={cx("settings-card")}><div className={cx("settings-card-heading")}><div><p className={cx("eyebrow")}>VALORES BASE</p><h2>Costos y tiempos</h2></div><SlidersHorizontal className={cx("settings-heading-icon")} /></div><div className={cx("parameters-form")}>{parameters.map((parameter, index) => <label className={cx("parameter-field")} key={parameter.label}><span className={cx("parameter-label")}>{parameter.label}</span><span className={cx("parameter-input-row")}><input type="number" min="0.01" step="any" value={parameter.value} placeholder={parameter.placeholder} onChange={(event) => handleValueChange(index, event.target.value)} /><span className={cx("parameter-unit")}>{parameter.unit}</span></span><span className={cx("parameter-updated")}>Última actualización: {parameter.updated}</span></label>)}</div><div className={cx("settings-footer")}><div>{confirmation && <p className={cx("settings-confirmation")} role="status"><Check />{confirmation}</p>}</div><button className={cx("primary-button save-button")} onClick={handleSave}><Save />Guardar parámetros</button></div></section>
  </main>
}

function Reports() {
  const [period, setPeriod] = useState('Últimos 30 días')
  const [sortBy, setSortBy] = useState<'quantity' | 'product'>('quantity')
  const reportData = useMemo(() => {
    const counts = orders.reduce<Record<string, number>>((result, order) => {
      result[order.product] = (result[order.product] ?? 0) + 1
      return result
    }, {})
    const total = orders.length
    return Object.entries(counts).map(([product, quantity]) => ({ product, quantity, percentage: Math.round((quantity / total) * 100) })).sort((a, b) => sortBy === 'product' ? a.product.localeCompare(b.product) : b.quantity - a.quantity)
  }, [sortBy])
  const maxQuantity = Math.max(...reportData.map((item) => item.quantity))

  return <main className={cx("main-content reports-page")}>
    <header className={cx("topbar")}><div className={cx("breadcrumb")}>Gestión <span>/</span> Reportes</div><div className={cx("topbar-actions")}><div className={cx("topbar-avatar")}>OP</div></div></header>
    <section className={cx("reports-header")}><div><p className={cx("eyebrow")}>ANÁLISIS OPERATIVO</p><h1>Reporte de pedidos por tipo de producto</h1><p className={cx("page-description")}>Identificá tendencias de demanda para tomar decisiones sobre el catálogo y la producción.</p></div><div className={cx("period-filter")}><label htmlFor="report-period">PERÍODO</label><select id="report-period" value={period} onChange={(event) => setPeriod(event.target.value)}><option>Últimos 7 días</option><option>Últimos 30 días</option><option>Este mes</option><option>Personalizado</option></select>{period === 'Personalizado' && <div className={cx("custom-dates")}><input type="date" aria-label="Desde" /><input type="date" aria-label="Hasta" /></div>}</div></section>
    {reportData.length === 0 ? <div className={cx("report-empty")}>No hay pedidos registrados en este período</div> : <>
      <section className={cx("report-card")}><div className={cx("report-card-heading")}><div><p className={cx("eyebrow")}>VISTA GRÁFICA</p><h2>Pedidos por producto</h2></div><span className={cx("report-total")}>{orders.length} pedidos</span></div><div className={cx("horizontal-chart")} aria-label="Gráfico de pedidos por tipo de producto">{reportData.map((item, index) => <div className={cx("chart-row")} key={item.product}><span className={cx("chart-label")}>{item.product}</span><div className={cx("chart-track")}><div className={cx(`chart-bar ${index === 0 ? 'chart-bar-highlight' : ''}`)} style={{ width: `${(item.quantity / maxQuantity) * 100}%` }} /></div><strong>{item.quantity}</strong></div>)}</div></section>
      <section className={cx("report-card report-table-card")}><div className={cx("report-card-heading")}><div><p className={cx("eyebrow")}>DETALLE</p><h2>Distribución del total</h2></div><span className={cx("report-total")}>Ordenado por cantidad</span></div><div className={cx("report-table")}> <div className={cx("report-table-head")}><button onClick={() => setSortBy('product')}>Tipo de producto</button><button onClick={() => setSortBy('quantity')}>Cantidad de pedidos</button><span>% del total</span></div>{reportData.map((item) => <div className={cx("report-table-row")} key={item.product}><strong>{item.product}</strong><span><b>{item.quantity}</b> pedidos</span><span>{item.percentage}%</span></div>)}</div></section>
    </>}
  </main>
}

function QuoteGeneration({ order, pendingOrders, onSelectOrder, onBack }: { order: Order; pendingOrders: Order[]; onSelectOrder: (order: Order) => void; onBack: () => void }) {
  const [generated, setGenerated] = useState(false)
  const printCost = order.quantity * 950
  const estimatedTime = order.quantity * 2.5
  const electricity = estimatedTime * 120
  const machineWear = estimatedTime * 350
  const labor = estimatedTime * 2400
  const total = printCost + electricity + machineWear + labor
  const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

  if (generated) return <main className={cx("main-content quote-page")}><header className={cx("topbar")}><div className={cx("breadcrumb")}>Gestión <span>/</span> Presupuesto</div><div className={cx("topbar-actions")}><div className={cx("topbar-avatar")}>OP</div></div></header><section className={cx("quote-success")}><div className={cx("success-icon")}><Check /></div><p className={cx("eyebrow")}>OPERACIÓN COMPLETADA</p><h1>Presupuesto generado</h1><p>Presupuesto generado con estado: <strong>Generado</strong></p><button className={cx("secondary-button")} onClick={onBack}><ChevronLeft /> Volver al pedido</button></section></main>

  return <main className={cx("main-content quote-page")}><header className={cx("topbar")}><div className={cx("breadcrumb")}>Gestión <span>/</span> Presupuesto</div><div className={cx("topbar-actions")}><div className={cx("topbar-avatar")}>OP</div></div></header><section className={cx("quote-header")}><button className={cx("back-button")} onClick={onBack}><ChevronLeft /> Volver al pedido</button><p className={cx("eyebrow")}>CÁLCULO DE PRESUPUESTO</p><h1>Generar presupuesto</h1><p className={cx("page-description")}>Revisá el desglose antes de confirmar el presupuesto del pedido.</p><div className={cx("quote-order-summary")}><strong>Pedido {order.code}</strong><span>{order.product} x{order.quantity} · {order.customer}</span></div></section><section className={cx("pending-quotes pending-quotes-header")}><div><p className={cx("eyebrow")}>PEDIDOS PENDIENTES</p><h3>Elegí qué pedido presupuestar</h3></div><div className={cx("pending-quotes-list")}>{pendingOrders.map((pendingOrder) => <button className={cx(`pending-quote-item ${pendingOrder.code === order.code ? 'pending-quote-item-active' : ''}`)} key={pendingOrder.code} onClick={() => onSelectOrder(pendingOrder)}><strong>Pedido {pendingOrder.code}</strong><span>{pendingOrder.product} x{pendingOrder.quantity} · {pendingOrder.customer}</span><ChevronRight /></button>)}</div></section><section className={cx("quote-card")}><div className={cx("quote-card-heading")}><div><p className={cx("eyebrow")}>DESGLOSE DEL CÁLCULO</p><h2>Detalle del presupuesto</h2></div><span className={cx("quote-status")}>Pendiente</span></div><div className={cx("quote-breakdown")}><div><span>Precio de material</span><strong>{money.format(printCost)}</strong></div><div><span>Tiempo estimado de impresión <small>({estimatedTime} h)</small></span><strong>{money.format(estimatedTime * 2400)}</strong></div><div><span>Electricidad</span><strong>{money.format(electricity)}</strong></div><div><span>Desgaste de máquina</span><strong>{money.format(machineWear)}</strong></div><div><span>Mano de obra</span><strong>{money.format(labor)}</strong></div></div><div className={cx("quote-total")}><span>Total del presupuesto</span><strong>{money.format(total)}</strong></div><p className={cx("quote-note")}>Calculado con los parámetros de cotización vigentes · 15 sep 2026</p><div className={cx("pending-quotes pending-quotes-top")}><div><p className={cx("eyebrow")}>PEDIDOS PENDIENTES</p><h3>Elegí qué pedido presupuestar</h3></div><div className={cx("pending-quotes-list")}>{pendingOrders.map((pendingOrder) => <button className={cx(`pending-quote-item ${pendingOrder.code === order.code ? 'pending-quote-item-active' : ''}`)} key={pendingOrder.code} onClick={() => onSelectOrder(pendingOrder)}><span><strong>{pendingOrder.code}</strong><small>{pendingOrder.customer} · {pendingOrder.product} x{pendingOrder.quantity}</small></span><ChevronRight /></button>)}</div></div><button className={cx("primary-button quote-generate-button")} onClick={() => setGenerated(true)}>Generar presupuesto</button><div className={cx("pending-quotes")}><div><p className={cx("eyebrow")}>PEDIDOS PENDIENTES</p><h3>Otros pedidos para presupuestar</h3></div><div className={cx("pending-quotes-list")}>{pendingOrders.map((pendingOrder) => <button className={cx(`pending-quote-item ${pendingOrder.code === order.code ? 'pending-quote-item-active' : ''}`)} key={pendingOrder.code} onClick={() => onSelectOrder(pendingOrder)}><span><strong>{pendingOrder.code}</strong><small>{pendingOrder.customer} · {pendingOrder.product} x{pendingOrder.quantity}</small></span><ChevronRight /></button>)}</div></div></section></main>
}

export function OperadorPanel() {
  const [activeFilter, setActiveFilter] = useState<Filter>('Todos')
  const [menuOpen, setMenuOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [activeView, setActiveView] = useState<'orders' | 'quote' | 'generate' | 'reports'>('orders')
  const [quoteOrder, setQuoteOrder] = useState<Order | null>(null)

  const pendingQuoteOrders = orders.filter((order) => order.status === 'Pendiente de presupuesto')

  const visibleOrders = useMemo(() => activeFilter === 'Todos' ? orders : orders.filter((order) => order.status === activeFilter), [activeFilter])
  const updateOrderStatus = (status: OrderStatus) => { if (selectedOrder) setSelectedOrder({ ...selectedOrder, status }) }
  return (
    <div className={cx("operador-root", "app-shell")}>
      <aside className={cx(`sidebar ${menuOpen ? 'sidebar-open' : ''}`)}>
        <div className={cx("sidebar-brand")}><span>J3D - IMPRESIONES</span><button className={cx("mobile-close")} onClick={() => setMenuOpen(false)} aria-label="Cerrar menú"><X /></button></div>
        <nav className={cx("sidebar-nav")} aria-label="Navegación principal">
          <button className={cx(`nav-item ${activeView === 'orders' ? 'nav-item-active' : ''}`)} onClick={() => { setActiveView('orders'); setSelectedOrder(null); setMenuOpen(false) }}><Package />Pedidos</button>
          <button className={cx(`nav-item ${activeView === 'quote' ? 'nav-item-active' : ''}`)} onClick={() => { setActiveView('quote'); setSelectedOrder(null); setMenuOpen(false) }}><FileText />Cotización</button>
          <button className={cx(`nav-item ${activeView === 'generate' ? 'nav-item-active' : ''}`)} onClick={() => { setActiveView('generate'); setQuoteOrder(orders[0]); setSelectedOrder(null); setMenuOpen(false) }}><ClipboardList />Presupuesto</button>
          <button className={cx(`nav-item ${activeView === 'reports' ? 'nav-item-active' : ''}`)} onClick={() => { setActiveView('reports'); setSelectedOrder(null); setMenuOpen(false) }}><BarChart3 />Reportes</button>
        </nav>
        <div className={cx("sidebar-footer")}><div className={cx("operator-avatar")}>OP</div><div><strong>Operador</strong><span>Panel de tienda</span></div></div>
      </aside>
      {menuOpen && <button className={cx("sidebar-overlay")} onClick={() => setMenuOpen(false)} aria-label="Cerrar menú" />}

      {activeView === 'quote' ? <QuoteParameters onBack={() => setActiveView('orders')} /> : activeView === 'generate' && quoteOrder ? <QuoteGeneration order={quoteOrder} pendingOrders={pendingQuoteOrders} onSelectOrder={setQuoteOrder} onBack={() => setActiveView('orders')} /> : activeView === 'reports' ? <Reports /> : selectedOrder ? <OrderDetail order={selectedOrder} onBack={() => setSelectedOrder(null)} onUpdate={updateOrderStatus} /> : <main className={cx("main-content")} id="pedidos">
        <header className={cx("topbar")}><button className={cx("mobile-menu")} onClick={() => setMenuOpen(true)} aria-label="Abrir menú"><Menu /></button><div className={cx("breadcrumb")}>Gestión <span>/</span> Pedidos</div><div className={cx("topbar-actions")}><div className={cx("topbar-avatar")}>OP</div></div></header>
        <section className={cx("page-header")}><div><p className={cx("eyebrow")}>OPERACIONES</p><h1>Pedidos ingresados</h1><p className={cx("page-description")}>Gestioná y seguí todos los pedidos personalizados de tu tienda.</p></div></section>

        <section className={cx("orders-section")} aria-label="Listado de pedidos">
          <div className={cx("filter-row")} role="group" aria-label="Filtrar pedidos">{filters.map((filter) => <button key={filter} className={cx(`filter-chip ${activeFilter === filter ? 'filter-chip-active' : ''}`)} onClick={() => setActiveFilter(filter)}>{filter}{filter !== 'Todos' && <span className={cx("filter-count")}>{orders.filter((order) => order.status === filter).length}</span>}</button>)}</div>
          <div className={cx("orders-list")}>
            {visibleOrders.length === 0 ? <div className={cx("empty-state")}><div className={cx("empty-icon")}><Package /></div><h2>Todavía no hay pedidos personalizados cargados</h2><p>Los nuevos pedidos aparecerán en este listado.</p></div> : visibleOrders.map((order) => <button className={cx("order-row")} key={order.code} onClick={() => setSelectedOrder(order)}><div className={cx("order-main")}><div className={cx("order-code")}>{order.code}</div><div className={cx("order-customer")}>{order.customer}</div></div><div className={cx("order-product")}><span className={cx("label")}>PRODUCTO</span><strong>{order.product}</strong><span className={cx("quantity")}>x{order.quantity}</span></div><div className={cx("order-delivery")}><span className={cx("label")}>ENTREGA</span><span className={cx("delivery-value")}>{order.delivery === 'Envío' ? <Truck /> : <Package />}{order.delivery}</span></div><div className={cx("order-date")}><span className={cx("label")}>FECHA ESTIMADA</span><strong>{order.date}</strong></div><StatusBadge status={order.status} /><ChevronRight className={cx("row-arrow")} /></button>)}
          </div>
        </section>
      </main>}
    </div>
  )
}
