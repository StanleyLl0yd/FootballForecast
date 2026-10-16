import type {ReactNode} from 'react';
export function EmptyState({title, description, icon}:{title:string,description:string,icon?:ReactNode}) {return <div className="empty-state"><div className="empty-icon">{icon ?? '◌'}</div><h3>{title}</h3><p>{description}</p></div>}
export function PageHeading({eyebrow,title,subtitle}:{eyebrow:string,title:string,subtitle:string}) {return <div className="page-heading"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{subtitle}</p></div>}
