import "./ParchmentContainer.css";

const ParchmentContainer = ({ children, withWrapper = true, className = "", style, ...props }) => {
  const container = (
    <div className={`parchment-container ${className}`.trim()} style={style} {...props}>
      <div className="parchment-frame" aria-hidden="true">
        <span className="parchment-rail parchment-rail-top" />
        <span className="parchment-rail parchment-rail-right" />
        <span className="parchment-rail parchment-rail-bottom" />
        <span className="parchment-rail parchment-rail-left" />
        <span className="parchment-corner parchment-corner-tl" />
        <span className="parchment-corner parchment-corner-tr" />
        <span className="parchment-corner parchment-corner-bl" />
        <span className="parchment-corner parchment-corner-br" />
        <span className="parchment-emblem" />
      </div>
      <div className="parchment-surface">{children}</div>
    </div>
  );

  if (!withWrapper) {
    return container;
  }

  return <div className="parchment-wrapper">{container}</div>;
};

export default ParchmentContainer;
