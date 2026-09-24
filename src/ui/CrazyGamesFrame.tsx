// Desktop gutters for the portrait Crazy Games guest build.
// Hidden on phone-width viewports; the play column itself is unchanged.
export function CrazyGamesFrame() {
  return (
    <div className="cg-frame" aria-hidden="true">
      <p className="cg-rail cg-rail--left">GET OFF THE TRAIN</p>
      <p className="cg-rail cg-rail--right">MIND THE DOORS</p>
      <aside className="cg-poster cg-poster--left">
        <span>ROUTE 1</span>
        <strong><b>GET</b><b>OFF</b><b>THE</b><b>TRAIN!</b></strong>
        <em>SWIPE TO THE DOOR</em>
      </aside>
      <aside className="cg-poster cg-poster--right">
        <span>LAST STOP</span>
        <strong><b>MIND</b><b>THE</b><b>DOORS</b></strong>
        <em>STAND CLEAR</em>
      </aside>
    </div>
  )
}
