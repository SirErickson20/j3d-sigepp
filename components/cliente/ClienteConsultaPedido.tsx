"use client"

import Image from "next/image"
import styles from "./cliente.module.css"
import { FormEvent, useState } from "react"

function cx(...values: Array<string | false | null | undefined>) {
  return values
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => value.split(" "))
    .map((className) => styles[className] ?? className)
    .join(" ")
}

const demoOrder = {
  code: "A4521",
  status: "En producción",
  product: "Mate",
  colors: "Rojo, blanco",
  quantity: "2 unidades",
  design: "Mate personalizado con el logo de la marca en el frente.",
  customer: "Lucía Fernández",
  email: "lucia.fernandez@email.com",
  phone: "1123456789",
  delivery: "Envío a domicilio",
  address: "Av. Corrientes 1234, CABA",
  modelImage: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-sCYkG6GJq7DqlBNWTPBV2guAGYweAT.png",
}

const orderStages = [
  "Pendiente de presupuesto",
  "En rediseño",
  "Pendiente de seña",
  "En producción",
  "Finalizado",
  "Pendiente de saldo",
  "Entregado",
] as const

export function ClienteConsultaPedido() {
  const [code, setCode] = useState("")
  const [result, setResult] = useState<typeof demoOrder | null>(null)
  const [searched, setSearched] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedCode = code.trim().toUpperCase()
    setSearched(true)
    setResult(normalizedCode === demoOrder.code ? demoOrder : null)
  }

  return (
    <main className={cx("cliente-root", "order-page")}>
      <div className={cx("app-shell")}>
        <aside className={cx(`sidebar ${menuOpen ? "open" : ""}`)}>
          <div className={cx("brand-mark")}>J3D - IMPRESIONES</div>
          <nav aria-label="Navegación principal">
            <a className={cx("nav-item")} href="/cliente" onClick={() => setMenuOpen(false)}><span className={cx("nav-dot")} />Nuevo pedido</a>
            <a className={cx("nav-item active")} href="/cliente/consultar-pedido" onClick={() => setMenuOpen(false)}><span className={cx("nav-dot")} />Consultar Pedido</a>
          </nav>
          <p className={cx("sidebar-footer")}>Pedidos a medida</p>
        </aside>
        <section className={cx("content-area")}>
          <div className={cx("mobile-topbar")}>
            <div className={cx("brand-mark")}>J3D - IMPRESIONES</div>
            <button className={cx("menu-button")} type="button" aria-label="Abrir menú" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>☰</button>
          </div>
          <div className={cx("status-shell")}>
        <header className={cx("status-header")}>
          <p className={cx("eyebrow")}>Seguimiento de pedido</p>
          <h1>Consultar mi pedido</h1>
          <p className={cx("status-intro")}>Revisá en qué etapa está tu pedido personalizado.</p>
        </header>

        <section className={cx("lookup-card")} aria-labelledby="lookup-title">
          <div className={cx("lookup-heading")}>
            <span className={cx("lookup-icon")} aria-hidden="true">⌕</span>
            <div>
              <h2 id="lookup-title">Ingresá tu código de pedido</h2>
              <p>Ej: A4521</p>
            </div>
          </div>
          <form className={cx("lookup-form")} onSubmit={handleSearch}>
            <label className={cx("sr-only")} htmlFor="order-code">Código de pedido</label>
            <input id="order-code" value={code} onChange={(event) => setCode(event.target.value)} placeholder="Ingresá tu código de pedido, ej: A4521" autoComplete="off" />
            <button className={cx("primary-button")} type="submit">Buscar <span aria-hidden="true">→</span></button>
          </form>
        </section>

        {!searched && <section className={cx("status-empty")} aria-live="polite"><span className={cx("empty-mark")} aria-hidden="true">⌁</span><p>Ingresá el código que te dieron al hacer tu pedido para ver en qué etapa está.</p></section>}
        {searched && result && <section className={cx("result-card")} aria-live="polite" aria-labelledby="result-title">
          <div className={cx("result-topline")}><div><p className={cx("eyebrow")}>Pedido encontrado</p><h2 id="result-title">Pedido #{result.code}</h2></div><span className={cx("order-status")}><span aria-hidden="true" />{result.status}</span></div>
          <div className={cx("progress-section")} aria-label="Progreso del pedido"><div className={cx("progress-heading")}><span>Estado del pedido</span><small>Etapa 4 de 7</small></div><ol className={cx("order-progress")}>{orderStages.map((stage, index) => <li key={stage} className={cx(index < 3 ? "completed" : index === 3 ? "current" : "")}><span className={cx("stage-number")}>{index + 1}</span><span className={cx("stage-label")}>{stage}</span></li>)}</ol></div>
          <div className={cx("order-overview")}><div><p className={cx("eyebrow")}>Detalles ingresados</p><h3>Tu pedido personalizado</h3></div><div className={cx("model-preview")}><Image src={result.modelImage} alt="Modelo de referencia enviado por el operador" width={150} height={105} unoptimized /><span>Modelo aprobado</span></div></div>
          <dl className={cx("result-details")}><div><dt>Tipo de producto</dt><dd>{result.product}</dd></div><div><dt>Colores</dt><dd>{result.colors}</dd></div><div><dt>Cantidad</dt><dd>{result.quantity}</dd></div><div><dt>Diseño requerido</dt><dd>{result.design}</dd></div><div><dt>Cliente</dt><dd>{result.customer}</dd></div><div><dt>Email</dt><dd>{result.email}</dd></div><div><dt>Número de teléfono</dt><dd>{result.phone}</dd></div><div><dt>Modalidad de entrega</dt><dd>{result.delivery}</dd></div><div className={cx("detail-wide")}><dt>Domicilio</dt><dd>{result.address}</dd></div></dl>
        </section>}
        {searched && !result && <section className={cx("status-error")} aria-live="polite"><span className={cx("error-mark")} aria-hidden="true">!</span><div><h2>No encontramos ese pedido</h2><p>No encontramos ningún pedido con ese código. Revisalo e intentá de nuevo.</p></div></section>}
        <a className={cx("back-link")} href="/cliente">← Volver a nuevo pedido</a>
          </div>
        </section>
      </div>
    </main>
  )
}
