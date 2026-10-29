import {pairReview} from '../lib/pair-review.mjs';
export function PairComparison({result,property,investor,expanded=false}){
 const review=pairReview(result,property,investor);
 return <section className='pair-review' aria-label='Usporedba uvjeta para'>
  {expanded&&<div className='pair-detail-score'><strong>{review.score==null?'Ocjena nije dostupna':review.score+' %'}</strong><span>{result.archived?'Povijesna spremljena ocjena':'Podudarnost bodovanih kriterija'} · {result.status}</span></div>}
  <div className='pair-review-totals'><span className='met'>Podudara se: <b>{review.met}</b></span><span className='unmet'>Ne podudara se: <b>{review.unmet}</b></span><span className='unknown'>Za dopunu / provjeru: <b>{review.missing}</b></span></div>
  {review.unmet>0&&<p className='pair-blocker' role='note'><b>Kritično odstupanje:</b> {(result.rejected||[]).join(' · ')}. Postotak ne uklanja ovu prepreku.</p>}
  <details open={expanded||undefined}><summary>Usporedi uvjete kupca i nekretninu</summary><div className='pair-comparison' role='region' aria-label='Tablična usporedba kupca i nekretnine' tabIndex={0}>
   <table className='pair-criteria-table'>
    <caption>Usporedba kupca i nekretnine po kriterijima</caption>
    <thead><tr><th scope='col'>Kriterij</th><th scope='col'>Zahtjev kupca</th><th scope='col'>Podatak nekretnine</th><th scope='col'>Rezultat</th></tr></thead>
    <tbody>{review.rows.map(row=><tr className={'pair-criterion '+row.state} key={row.state+row.label}>
     <th scope='row'>{row.label}</th><td>{row.buyer}</td><td>{row.property}</td>
     <td><span className={'pair-result '+row.state}><span aria-hidden='true'>{row.state==='met'?'✓':row.state==='unmet'?'✕':row.state==='unknown'?'?':'i'}</span> {row.status}</span><small>{row.explanation}</small></td>
    </tr>)}</tbody>
   </table>
  </div><p className='pair-score-note'><b>Bodovani kriteriji:</b> {review.scored.join(' · ')}.</p><p className='pair-score-note'>{review.scoreExplanation}</p></details>
  {review.missing>0&&<p className='pair-next'><b>Sljedeći korak:</b> {(result.missing||[]).slice(0,3).join(' · ')}{review.missing>3?` · još ${review.missing-3} stavki u detalju`:''}. Otvori detalj para za pitanja, odgovore i dokaze.</p>}
  {!result.archived&&result.status==='Podudaranje kriterija'&&!review.missing&&!review.unmet&&<p className='pair-next'>Kriteriji su zadovoljeni prema spremljenom izračunu. Prije prezentacije ručno pregledaj podatke; interes kupca još nije potvrđen.</p>}
 </section>;
}
export const pairStyles=`.pill.change{background:#e3efe8;color:#1f4d3c;margin-left:6px}

.pair-detail-score{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:18px}.pair-detail-score strong{font-size:30px}.pair-detail-score span{font-size:13px;color:#56665e}.match-card{padding:22px;min-width:0;border:1px solid #d9e2df;border-radius:16px;background:#fff;margin-bottom:18px;overflow-wrap:anywhere}
.match-top{display:flex;justify-content:space-between;align-items:flex-start;gap:20px}.match-top>div{min-width:0}.match-score{flex-shrink:0;text-align:right}.match-score strong{display:block;font-size:30px}.pair-score-label{display:block;font-size:12px;color:#56665e;margin:4px 0 8px}.pair-record-facts{color:#56665e;font-size:13px;line-height:1.7}
.pair-review{margin-top:18px}.pair-review-totals{display:flex;flex-wrap:wrap;gap:8px}.pair-review-totals>span{padding:7px 10px;border-radius:8px;background:#f0f4f2;font-size:13px}.pair-review-totals .unmet{color:#922f32;background:#fff0f0}.pair-review-totals .unknown{color:#78531b;background:#fff6e5}.pair-review-totals .met{color:#24634a;background:#edf7f0}
.pair-review summary{cursor:pointer;font-weight:600;padding:16px 0;color:#244f41}.pair-comparison{display:grid;gap:10px}.pair-criterion{padding:14px;border:1px solid #e0e6e3;border-left:4px solid #688577;border-radius:10px;min-width:0;background:#f8faf9}.pair-criterion.unmet{border-left-color:#b54447}.pair-criterion.unknown{border-left-color:#b27b27}.pair-criterion header{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}.pair-criterion h4{margin:0;font-size:14px}.pair-criterion header>span{font-size:12px}.pair-criterion dl{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin:12px 0 0}.pair-criterion dl>div{min-width:0}.pair-criterion dt{font-size:11px;color:#5c6d64;text-transform:uppercase;letter-spacing:.04em}.pair-criterion dd{margin:4px 0 0;font-size:14px;font-weight:500;overflow-wrap:anywhere}.pair-criterion p,.pair-score-note{font-size:12px;color:#5c6d64;line-height:1.65;margin:10px 0 0}.pair-blocker{padding:12px;background:#fff0f0;color:#922f32;border-radius:8px;font-size:13px}.pair-next{padding:13px;background:#f3f6f4;border-radius:8px;font-size:13px;line-height:1.7}.match-details{display:flex;flex-wrap:wrap;gap:12px;align-items:center}.pair-workflow{display:flex;flex-wrap:wrap;gap:12px;margin:16px 0}.pair-workflow span{padding:10px 14px;border-radius:10px;background:#edf3ef;color:#315743}
@media(max-width:600px){.match-card{padding:16px}.match-top{flex-direction:column;gap:12px}.match-score{display:flex;align-items:center;gap:12px;flex-wrap:wrap;text-align:left}.match-score strong{font-size:26px}.pair-criterion dl{grid-template-columns:1fr;gap:12px}.pair-review-totals{gap:6px}.pair-review-totals>span{font-size:12px}.match-details>span{width:100%}.pair-workflow{display:grid}.pair-review summary{line-height:1.6}}
`;

export const comparisonTableStyles=`
.pair-review .pair-comparison{display:block;overflow-x:auto;border:1px solid #d8e1dd;border-radius:12px;margin-top:4px;max-width:100%;background:#fff}
.pair-comparison:focus-visible{outline:3px solid #496e60;outline-offset:3px}
.pair-review .pair-criteria-table{width:100%;min-width:640px;border-collapse:collapse;table-layout:fixed;white-space:normal;text-align:left}
.pair-criteria-table caption{text-align:left;padding:14px 16px;font-weight:600;font-size:13px;color:#304d40;background:#f4f7f5}
.pair-review .pair-criteria-table th,.pair-review .pair-criteria-table td{padding:14px 16px;vertical-align:top;border:0;border-bottom:1px solid #e3e9e5;white-space:normal;overflow-wrap:anywhere;font-size:13px;line-height:1.6}
.pair-review .pair-criteria-table thead th{background:#edf2ef;color:#344e42;font-size:12px;font-weight:700}
.pair-criteria-table thead th:first-child{width:21%}.pair-criteria-table thead th:last-child{width:29%}
.pair-review .pair-criteria-table tbody tr{border:0;border-radius:0;background:#fff}
.pair-review .pair-criteria-table tbody tr:nth-child(even){background:#f8faf9}
.pair-review .pair-criteria-table tbody th{font-weight:600;color:#243d31}
.pair-review .pair-criteria-table small{display:block;white-space:normal;line-height:1.6;margin-top:7px;color:#53665b;font-size:12px}
.pair-result{display:inline-flex;align-items:center;gap:5px;font-weight:600;padding:4px 8px;border-radius:6px;font-size:12px;line-height:1.5}
.graphite-theme .pair-review .pair-comparison{background:#252b34;border-color:#505a69}.graphite-theme .pair-criteria-table caption{background:#2d3540;color:#e6edf5}.graphite-theme .pair-review .pair-criteria-table thead th{background:#202731;color:#d9e4ee}.graphite-theme .pair-review .pair-criteria-table tbody tr{background:#2b323d}.graphite-theme .pair-review .pair-criteria-table tbody tr:nth-child(even){background:#303946}.graphite-theme .pair-review .pair-criteria-table th,.graphite-theme .pair-review .pair-criteria-table td{color:#edf2f8;border-bottom-color:#4b5564}.graphite-theme .pair-review .pair-criteria-table small{color:#c2cddd}
.pair-result.met{background:#e8f4ed;color:#205c3d}.pair-result.unmet{background:#fcebec;color:#8b292f}.pair-result.unknown{background:#fff2d9;color:#755013}.pair-result.info{background:#edf1f6;color:#3e536a}
@media(max-width:600px){.pair-review .pair-criteria-table{min-width:600px}.pair-review .pair-criteria-table th,.pair-review .pair-criteria-table td{padding:12px}.pair-comparison::after{content:'Povuci tablicu lijevo ili desno za usporedbu svih stupaca.';display:block;padding:10px 12px;font-size:12px;color:#53665b;position:sticky;left:0;width:calc(100vw - 100px);max-width:100%;box-sizing:border-box}}
`;
