import {listingContext} from '../lib/listing-context.mjs';

/** Source identity and availability are internal research information. */
export function ListingContext({property,showPrice=false}){
 const context=listingContext(property);
 return <div className='listing-context' style={{display:'grid',gap:6,fontSize:12,lineHeight:1.5,whiteSpace:'normal',overflowWrap:'anywhere'}}>
  {showPrice&&<span>{context.priceBasis}</span>}
  <span>{context.availability}</span>
  {context.record&&<span>{context.record}</span>}
  {context.agency&&<span>Izvorna agencija: {context.agency}</span>}
  <span>{context.contactLabel}{context.contactName?' · '+context.contactName:''}</span>
  {context.source?<a href={context.source.url} target='_blank' rel='noopener noreferrer' aria-label={'Izvorni oglas za '+(property.title||context.record||'nekretninu')}>Izvorni oglas · {context.source.host}</a>:<span>Izvor nije naveden</span>}
 </div>;
}
