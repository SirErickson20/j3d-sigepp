"use client"

import Image from "next/image"
import { FormEvent, useState } from "react"
import { consultarPedido } from "@/app/actions/pedidos"
import { requierePresupuesto } from "@/lib/pedidos/estados"
import { ORDER_STATUSES, type ClientOrder } from "@/lib/pedidos/types"
import styles from "./cliente.module.css"

function cx(...values: Array<string | false | null | undefined>) {
  return values
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => value.split(" "))
    .map((className) => styles[className] ?? className)
    .join(" ")
}

export function ClienteConsultaPedido() {
  const [code, setCode] = useState("")
  const [result, setResult] = useState<ClientOrder | null>(null)
  const [searched, setSearched] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError("")
    const response = await consultarPedido(code)
    setPending(false)
    setSearched(true)

    if (!response.ok) {
      setResult(null)
      setError(response.error)
      return
    }

    setResult(response.order)
  }

  const currentIndex = result ? ORDER_STATUSES.indexOf(result.status) : -1
  const address = [result?.address, result?.city].filter(Boolean).join(", ")

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
                <button className={cx("primary-button")} type="submit" disabled={pending}>
                  {pending ? "Buscando..." : "Buscar"} <span aria-hidden="true">→</span>
                </button>
              </form>
            </section>

            {!searched && (
              <section className={cx("status-empty")} aria-live="polite">
                <span className={cx("empty-mark")} aria-hidden="true">⌁</span>
                <p>Ingresá el código que te dieron al hacer tu pedido para ver en qué etapa está.</p>
              </section>
            )}
            {searched && result && (
              <section className={cx("result-card")} aria-live="polite" aria-labelledby="result-title">
                <div className={cx("result-topline")}>
                  <div>
                    <p className={cx("eyebrow")}>Pedido encontrado</p>
                    <h2 id="result-title">Pedido #{result.code}</h2>
                  </div>
                  <span className={cx("order-status")}><span aria-hidden="true" />{result.status}</span>
                </div>
                <div className={cx("progress-section")} aria-label="Progreso del pedido">
                  <div className={cx("progress-heading")}>
                    <span>Estado del pedido</span>
                    <small>Etapa {currentIndex + 1} de {ORDER_STATUSES.length}</small>
                  </div>
                  <ol className={cx("order-progress")}>
                    {ORDER_STATUSES.map((stage, index) => (
                      <li key={stage} className={cx(index < currentIndex ? "completed" : index === currentIndex ? "current" : "")}>
                        <span className={cx("stage-number")}>{index + 1}</span>
                        <span className={cx("stage-label")}>{stage}</span>
                      </li>
                    ))}
                  </ol>
                </div>
                <div className={cx("order-overview")}>
                  <div>
                    <p className={cx("eyebrow")}>Detalles ingresados</p>
                    <h3>Tu pedido personalizado</h3>
                  </div>
                  {result.quote ? (
                    <div className={cx("quote-amount")}>
                      <span>Monto a abonar</span>
                      <strong>{new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(result.quote.total)}</strong>
                      <span>Fecha estimada de entrega</span>
                      <b>{result.quote.deliveryDateLabel}</b>
                    </div>
                  ) : requierePresupuesto(result.status) && (
                    <div className={cx("quote-amount quote-pending")}>
                      <span>Presupuesto</span>
                      <b>En preparación</b>
                      <small>Todavía estamos preparando el presupuesto de tu pedido. Consultá de nuevo más tarde con tu código.</small>
                    </div>
                  )}
                  {result.referenceUrl && (
                    <div className={cx("model-preview")}>
                      <Image src={result.referenceUrl} alt="Archivo de referencia del pedido" width={150} height={105} unoptimized />
                      <span>{result.referenceFile ?? "Referencia"}</span>
                    </div>
                  )}
                </div>
                <dl className={cx("result-details")}>
                  <div><dt>Tipo de producto</dt><dd>{result.product}</dd></div>
                  <div><dt>Colores</dt><dd>{result.colors.join(", ")}</dd></div>
                  <div><dt>Cantidad</dt><dd>{result.quantity} unidades</dd></div>
                  <div><dt>Diseño requerido</dt><dd>{result.designDescription}</dd></div>
                  <div><dt>Cliente</dt><dd>{result.customer}</dd></div>
                  <div><dt>Email</dt><dd>{result.email}</dd></div>
                  <div><dt>Número de teléfono</dt><dd>{result.phone}</dd></div>
                  <div><dt>Modalidad de entrega</dt><dd>{result.delivery === "Envío" ? "Envío a domicilio" : "Retiro en local"}</dd></div>
                  {address && <div className={cx("detail-wide")}><dt>Domicilio</dt><dd>{address}</dd></div>}
                </dl>
              </section>
            )}
            {searched && !result && (
              <section className={cx("status-error")} aria-live="polite">
                <span className={cx("error-mark")} aria-hidden="true">!</span>
                <div>
                  <h2>No encontramos ese pedido</h2>
                  <p>{error || "No encontramos ningún pedido con ese código. Revisalo e intentá de nuevo."}</p>
                </div>
              </section>
            )}
            <a className={cx("back-link")} href="/cliente">← Volver a nuevo pedido</a>
          </div>
        </section>
      </div>
    </main>
  )
}
