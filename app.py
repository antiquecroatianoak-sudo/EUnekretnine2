import streamlit as st, sqlite3, os, csv, io, json
from import_verified import validate, run as import_batch
from datetime import datetime
DB=os.path.join(os.path.dirname(__file__),'eu_platform.db')
EU=['Austrija','Belgija','Bugarska','Hrvatska','Cipar','Češka','Danska','Estonija','Finska','Francuska','Njemačka','Grčka','Mađarska','Irska','Italija','Latvija','Litva','Luksemburg','Malta','Nizozemska','Poljska','Portugal','Rumunjska','Slovačka','Slovenija','Španjolska','Švedska']
PRIORITY=['Francuska','Nizozemska','Slovenija','Litva','Austrija','Belgija']
from storage import connect
try:
 database_url = os.environ.get('DATABASE_URL') or st.secrets.get('DATABASE_URL')
except Exception:
 database_url = os.environ.get('DATABASE_URL')
c=connect(url=database_url)
if c.execute('SELECT COUNT(*) AS total FROM sources').fetchone()['total']==0:
 sources=[('Francuska','Enchères du Domaine','https://encheres-domaine.gouv.fr/','Državne dražbe'),('Francuska','Enchères Publiques','https://www.encheres-publiques.com/','Dražbe'),('Nizozemska','Openbare Verkoop','https://www.openbareverkoop.nl/','Dražbe'),('Nizozemska','Centraal Insolventieregister','https://www.rechtspraak.nl/registers/insolventieregister','Insolventnost')]
 c.executemany('INSERT INTO sources(country,name,url,category) VALUES(?,?,?,?)',sources);c.commit()
st.set_page_config(page_title='EU Investicijske prilike',layout='wide')
st.title('EU Investicijske prilike')
st.caption('Središnja baza: Supabase PostgreSQL' if database_url else 'Lokalna SQLite baza • internetska sinkronizacija nije povezana')
st.caption('Radni prototip • stvarni podaci tek nakon provjere • bez automatskog slanja poruka')
tabs=st.tabs(['Nadzorna ploča','Nekretnine','Analiza','Investitori','Podudaranja','Pipeline','Izvori','Karta'])
props=[dict(r) for r in c.execute('SELECT * FROM properties ORDER BY id DESC')];investors=[dict(r) for r in c.execute('SELECT * FROM investors ORDER BY id DESC')]
with tabs[0]:
 a,b,d,e=st.columns(4);a.metric('Nekretnine',len(props));b.metric('Pravno provjerene',sum(p['legal']=='Uredno' for p in props));d.metric('Investitori',len(investors));e.metric('Prioritetne države',len(PRIORITY))
 st.write('Prioritet:',', '.join(PRIORITY));
 st.caption('Pravna provjera modela: čeka se odgovor HGK / Your Europe Advice 478010.')
 pending=[dict(r) for r in c.execute("SELECT * FROM notification_outbox ORDER BY id DESC")]
 if pending:
  st.subheader('Integrirane prilike — evidencija obavijesti')
  st.dataframe(pending,use_container_width=True)
 st.info('Sustav ne sadrži izmišljene nekretnine ili investitore. Izvori su početne poveznice, ne automatski provjereni oglasi.')
with tabs[1]:
 with st.form('new_property'):
  country=st.selectbox('Država',EU,index=EU.index('Francuska'));city=st.text_input('Grad');title=st.text_input('Naziv nekretnine');price=st.number_input('Tražena cijena EUR',min_value=0.0);area=st.number_input('Površina m²',min_value=0.0);source=st.text_input('URL izvornog oglasa');legal=st.selectbox('Pravni status',['Nepoznato','Uredno','Komplikacije']);renovation=st.number_input('Procjena obnove EUR',min_value=0.0);other=st.number_input('Ostali troškovi EUR',min_value=0.0);value=st.number_input('Procijenjena tržišna vrijednost EUR',min_value=0.0);submitted=st.form_submit_button('Spremi nekretninu')
  if submitted:
   if not title or not source:st.error('Unesi naziv i izvor oglasa.')
   else:c.execute('INSERT INTO properties(country,city,title,price,area,source,legal,renovation,other_costs,estimated_value,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?)',(country,city,title,price,area,source,legal,renovation,other,value or None,datetime.now().isoformat()));c.commit();st.rerun()
 st.subheader('Uvoz provjerenih zapisa')
 st.caption('JSON popis zapisa za pilot: Francuska i Nizozemska. Provjera izvora i aktivnosti oglasa nije pravna provjera.')
 with st.expander('Obavezna polja i pravila uvoza'):
  st.write('country, city, title, source, evidence_url, checked_at (s vremenskom zonom), source_verified=true, listing_active=true, legal, price, area, renovation, other_costs.')
  st.write('Za pravni status Uredno potreban je legal_evidence_url. Za estimated_value potreban je valuation_evidence_url. Duplikati prema izvornom URL-u se preskaču.')
 upload=st.file_uploader('Odaberi JSON datoteku',type=['json'],key='verified_batch')
 if upload is not None:
  try:
   if upload.size > 5_000_000: raise ValueError('Najveća veličina datoteke je 5 MB.')
   items=json.loads(upload.getvalue().decode('utf-8-sig'))
   if not isinstance(items,list) or not items: raise ValueError('Očekuje se neprazan JSON popis zapisa.')
   if len(items)>1000: raise ValueError('Najviše 1000 zapisa po uvozu.')
   for index,item in enumerate(items,1):
    if not isinstance(item,dict): raise ValueError(f'Zapis {index}: očekuje se objekt.')
    try: validate(item)
    except (ValueError,TypeError,AttributeError) as error: raise ValueError(f'Zapis {index}: {error}') from error
   st.dataframe([{k:item.get(k) for k in ('title','country','city','price','legal','source','checked_at')} for item in items],use_container_width=True)
   st.caption(f'Provjerena struktura za {len(items)} zapisa. Sadržaj dokaza mora provjeriti osoba koja priprema uvoz.')
   confirmed=st.checkbox('Potvrđujem da su izvori, aktivnost oglasa i priloženi dokazi provjereni.',key='confirm_'+str(upload.file_id))
   if st.button('Uvezi provjerene zapise',disabled=not confirmed):
    try:
     inserted=import_batch(c,items)
    except Exception:
     st.error('Uvoz nije spremljen. Transakcija je poništena; provjeri vezu s bazom i pokušaj ponovno.')
    else:
     st.session_state['import_result']=f'Uvezeno: {inserted}. Preskočeno duplikata: {len(items)-inserted}.'
     st.rerun()
  except (ValueError,UnicodeError,TypeError,AttributeError) as error:
   st.error(f'Datoteka nije spremna za uvoz: {error}')
 if 'import_result' in st.session_state:
  st.success(st.session_state.pop('import_result'))
 st.subheader('Pretraživanje nekretnina')
 search=st.text_input('Naziv, grad ili izvor',key='property_search').strip().casefold()
 f1,f2,f3=st.columns(3)
 countries=f1.multiselect('Države',sorted({p['country'] for p in props if p['country']}))
 legal_filters=f2.multiselect('Pravni status', ['Nepoznato','Uredno','Komplikacije'])
 stages_filter=f3.multiselect('Faza postupka',sorted({p['status'] for p in props if p['status']}))
 f1,f2,f3,f4=st.columns(4)
 min_price=f1.number_input('Cijena od EUR',min_value=0.0,key='filter_min_price')
 max_price=f2.number_input('Cijena do EUR (0 = bez granice)',min_value=0.0,key='filter_max_price')
 min_area=f3.number_input('Površina od m²',min_value=0.0,key='filter_min_area')
 max_area=f4.number_input('Površina do m² (0 = bez granice)',min_value=0.0,key='filter_max_area')
 invalid=(max_price and max_price<min_price) or (max_area and max_area<min_area)
 if invalid: st.warning('Gornja granica mora biti veća ili jednaka donjoj.')
 filtered=[] if invalid else [p for p in props if
  (not search or search in ' '.join(str(p.get(k) or '') for k in ('title','city','source')).casefold())
  and (not countries or p['country'] in countries)
  and (not legal_filters or p['legal'] in legal_filters)
  and (not stages_filter or p['status'] in stages_filter)
  and p['price'] is not None and p['price']>=min_price and (not max_price or p['price']<=max_price)
  and p['area'] is not None and p['area']>=min_area and (not max_area or p['area']<=max_area)]
 st.caption(f'Prikazano {len(filtered)} od {len(props)} nekretnina.')
 st.dataframe(filtered,use_container_width=True)
 if not filtered: st.info('Nema nekretnina koje odgovaraju odabranim filtrima.')
with tabs[2]:
 eligible=[p for p in props if p['legal']=='Uredno']
 if not eligible:st.info('Nema pravno provjerenih nekretnina za analizu.')
 else:
  p=st.selectbox('Nekretnina',eligible,format_func=lambda x:x['title']);cost=p['price']+p['renovation']+p['other_costs'];st.metric('Ukupni procijenjeni trošak',f'{cost:,.0f} €');
  if p['estimated_value'] is not None:
   profit=p['estimated_value']-cost;st.metric('Potencijalna razlika (prije poreza i nepredviđenih troškova)',f'{profit:,.0f} €');st.metric('Jednostavni ROI',f'{100*profit/cost:.1f}%' if cost else 'N/A')
with tabs[3]:
 with st.form('new_investor'):
  name=st.text_input('Naziv investitora / tvrtke');icountry=st.selectbox('Sjedište',EU);minb=st.number_input('Minimalni budžet EUR',min_value=0.0);maxb=st.number_input('Maksimalni budžet EUR',min_value=0.0);prefs=st.multiselect('Zanimljive države',EU);notes=st.text_area('Kriteriji / napomene');verified=st.checkbox('Kriteriji su potvrđeni');save=st.form_submit_button('Spremi investitora')
  if save:
   if not name or maxb<minb:st.error('Provjeri naziv i budžet.')
   else:c.execute('INSERT INTO investors(name,country,min_budget,max_budget,preferred_countries,notes,verified) VALUES(?,?,?,?,?,?,?)',(name,icountry,minb,maxb,','.join(prefs),notes,int(verified)));c.commit();st.rerun()
 st.dataframe(investors,use_container_width=True)
with tabs[4]:
 matches=[]
 for p in props:
  if p['legal']!='Uredno':continue
  cost=p['price']+p['renovation']+p['other_costs']
  for i in investors:
   if i['verified'] and i['min_budget']<=cost<=i['max_budget'] and p['country'] in (i['preferred_countries'] or '').split(','):matches.append({'Nekretnina':p['title'],'Investitor':i['name'],'Država':p['country'],'Procijenjeni ukupni trošak EUR':cost})
 st.dataframe(matches,use_container_width=True);st.caption('Podudaranje prema državi i budžetu; nije dokaz investitorova interesa niti pravne podobnosti.')
with tabs[5]:
 stages=['Novo','Provjera','Analiza','Investitor identificiran','Ponuda','Ugovor','Zatvoreno']
 if props:
  p=st.selectbox('Odaberi nekretninu',props,format_func=lambda x:f"{x['id']} – {x['title']}");stage=st.selectbox('Faza',stages,index=stages.index(p['status']) if p['status'] in stages else 0)
  if st.button('Ažuriraj fazu'):c.execute('UPDATE properties SET status=? WHERE id=?',(stage,p['id']));c.commit();st.rerun()
 for s in stages:
  with st.expander(f'{s} ({sum(p["status"]==s for p in props)})'):
   for p in props:
    if p['status']==s:st.write(p['title'], '—',p['country'])
with tabs[6]:
 st.dataframe([dict(r) for r in c.execute('SELECT * FROM sources')],use_container_width=True)
 st.caption('Ove poveznice su početni izvori. Nije uključeno automatsko dohvaćanje oglasa.')
with tabs[7]:
 st.info('Karta će prikazivati geokodirane lokacije nakon što se poveže pouzdan geokoder i podaci o nekretninama.')

