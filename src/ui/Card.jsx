import React from "react";

export default function Card({ title, subtitle, right, children }) {
  return (
    <div className="card">
      <div className="cardHead">
        <div>
          <h2 className="title">{title}</h2>
          {subtitle ? <p className="subtitle">{subtitle}</p> : null}
        </div>
        {right ? <div>{right}</div> : null}
      </div>
      <div className="hr" />
      {children}
    </div>
  );
}
