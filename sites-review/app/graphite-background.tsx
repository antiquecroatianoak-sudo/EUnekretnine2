/** Fixed channels with a continuous colour wave; no travelling line segments. */
export function GraphiteBackground() {
  const channels = [
    'M-120 180 L420 520 L1600 100',
    'M420 520 L950 1120',
    'M1030 -100 L1210 420 L1600 760',
    'M-100 1000 L360 700 L670 1050',
  ];
  return <div className="graphite-backdrop" aria-hidden="true">
    <svg viewBox="0 0 1440 1000" preserveAspectRatio="xMidYMid slice" focusable="false">
      <defs>
        <linearGradient id="graphite-facet" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#343940"/><stop offset="1" stopColor="#23272d"/>
        </linearGradient>
        <linearGradient id="channel-spectrum-static" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#477ee8"/><stop offset=".5" stopColor="#a480ee"/><stop offset="1" stopColor="#536be0"/>
        </linearGradient>
        <linearGradient id="channel-spectrum" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#477ee8"><animate attributeName="stop-color" values="#477ee8;#8060d8;#b39aef;#536be0;#477ee8" dur="12s" repeatCount="indefinite"/></stop>
          <stop offset=".33" stopColor="#8060d8"><animate attributeName="stop-color" values="#8060d8;#b39aef;#536be0;#477ee8;#8060d8" dur="12s" repeatCount="indefinite"/></stop>
          <stop offset=".67" stopColor="#b39aef"><animate attributeName="stop-color" values="#b39aef;#536be0;#477ee8;#8060d8;#b39aef" dur="12s" repeatCount="indefinite"/></stop>
          <stop offset="1" stopColor="#536be0"><animate attributeName="stop-color" values="#536be0;#477ee8;#8060d8;#b39aef;#536be0" dur="12s" repeatCount="indefinite"/></stop>
        </linearGradient>
      </defs>
      <path fill="url(#graphite-facet)" d="M0 0H1010L1170 410 420 520 0 255Z"/>
      <path fill="#292d34" d="M0 265 420 530 830 1000H0Z"/>
      <path fill="#20242b" d="M430 525 1440 165V1000H850Z"/>
      <path fill="#30343b" d="M1040 0H1440V600L1220 410Z"/>
      <g fill="none" strokeLinejoin="miter">
        {channels.map(d=><g key={d}>
          <path d={d} className="channel-recess"/>
          <path d={d} className="channel-base" stroke="url(#channel-spectrum)"/>
        </g>)}
      </g>
    </svg>
  </div>;
}
