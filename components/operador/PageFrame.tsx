'use client'

import { Fragment, type ReactNode } from 'react'
import { Menu } from 'lucide-react'
import { cx } from './cx'
import { useOperadorMenu } from './OperadorShell'

type PageFrameProps = {
  breadcrumb: string[]
  eyebrow: string
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
}

export function PageFrame({ breadcrumb, eyebrow, title, description, actions, children }: PageFrameProps) {
  const { openMenu } = useOperadorMenu()

  return (
    <div className={cx("page-frame")}>
      <header className={cx("topbar")}>
        <button className={cx("mobile-menu")} type="button" onClick={openMenu} aria-label="Abrir menú">
          <Menu />
        </button>
        <div className={cx("breadcrumb")}>
          {breadcrumb.map((item, index) => (
            <Fragment key={`${item}-${index}`}>
              {index > 0 && <span>/</span>}
              {item}
            </Fragment>
          ))}
        </div>
        <div className={cx("topbar-actions")}><div className={cx("topbar-avatar")}>OP</div></div>
      </header>
      <section className={cx("page-header")}>
        <div className={cx("page-header-copy")}>
          <p className={cx("eyebrow")}>{eyebrow}</p>
          <h1>{title}</h1>
          {description ? <p className={cx("page-description")}>{description}</p> : null}
        </div>
        {actions ? <div className={cx("page-header-actions")}>{actions}</div> : null}
      </section>
      <div className={cx("page-body")}>{children}</div>
    </div>
  )
}

export function Panel({ eyebrow, title, extra, children }: { eyebrow: string; title: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <section className={cx("panel")}>
      <div className={cx("panel-heading")}>
        <div>
          <p className={cx("eyebrow")}>{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        {extra}
      </div>
      {children}
    </section>
  )
}
