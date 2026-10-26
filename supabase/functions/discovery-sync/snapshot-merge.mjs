// Listing refresh and national enrichment are independent evidence streams.
export function mergeSnapshot(prior,incoming){
 if(!prior)return incoming;
 return {...prior,...incoming,first_seen:prior.first_seen||incoming.first_seen,status:prior.status||incoming.status,verified:prior.verified===true,
  facts:{...(prior.facts||{}),...incoming.facts,...(prior.facts?.registry_enrichment?{registry_enrichment:prior.facts.registry_enrichment}:{})}};
}

