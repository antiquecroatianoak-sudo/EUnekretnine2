"""Forms for explicit property facts and buyer requirements."""
import json
from datetime import datetime, timezone
import streamlit as st
from matching import PROPERTY_TYPES, CONDITIONS, validate_criteria, valid_url, parse_criteria, refresh_matches, country_name, digest, check_valid


def property_form(c, props, countries):
    selected = st.selectbox('Nova nekretnina ili uređivanje postojeće', [None] + [p['id'] for p in props], format_func=lambda x: 'Nova nekretnina' if x is None else next(p['title'] for p in props if p['id'] == x), key='property_edit')
    p = next((p for p in props if p['id'] == selected), {})
    if p.get('country'): p=dict(p,country=country_name(p['country']))
    def num(label, field):
        value = p.get(field)
        return st.number_input(label, min_value=0.0, value=float(value) if value is not None else None)
    with st.form('property_' + str(selected)):
        country = st.selectbox('Država', countries, index=countries.index(p.get('country', 'Hrvatska')) if p.get('country', 'Hrvatska') in countries else 0)
        city = st.text_input('Grad', value=p.get('city') or '')
        region = st.text_input('Regija / županija', value=p.get('region') or '')
        title = st.text_input('Naziv nekretnine', value=p.get('title') or '')
        types = ['Nepoznato'] + PROPERTY_TYPES
        conditions = ['Nepoznato'] + CONDITIONS
        kind = st.selectbox('Vrsta nekretnine', types, index=types.index(p.get('property_type')) if p.get('property_type') in types else 0)
        condition = st.selectbox('Stanje / namjena radova', conditions, index=conditions.index(p.get('condition')) if p.get('condition') in conditions else 0)
        price = num('Tražena cijena EUR', 'price')
        area = num('Površina m²', 'area')
        renovation = num('Procjena obnove / rušenja i radova EUR', 'renovation')
        other = num('Ostali troškovi EUR', 'other_costs')
        value = num('Procijenjena tržišna vrijednost EUR', 'estimated_value')
        st.caption('Nepoznate iznose ostavi prazne. Nulu unesi samo ako je trošak provjereno nula. Procjena gradnje i svi troškovi moraju biti obuhvaćeni za smislen izračun.')
        source = st.text_input('URL izvornog oglasa', value=p.get('source') or '')
        legal_options = ['Nepoznato', 'Uredno', 'Komplikacije']
        legal = st.selectbox('Pravni status', legal_options, index=legal_options.index(p.get('legal')) if p.get('legal') in legal_options else 0)
        legal_source = st.text_input('URL dokaza pravne provjere', value=p.get('legal_evidence_url') or '')
        valuation = st.text_input('URL dokaza procjene vrijednosti', value=p.get('valuation_evidence_url') or '')
        planning_options = ['Nepoznato', 'Da', 'Ne']
        buildable = st.selectbox('Mogućnost planirane gradnje potvrđena', planning_options, index=planning_options.index(p.get('buildable')) if p.get('buildable') in planning_options else 0)
        planning = st.text_input('URL dokaza mogućnosti gradnje', value=p.get('planning_evidence_url') or '')
        until = st.text_input('Rok dostupnosti / dražbe (YYYY-MM-DD, prazno ako nepoznato)', value=p.get('available_until') or '')
        if st.form_submit_button('Spremi nekretninu'):
            try:
                if not title.strip() or not valid_url(source): raise ValueError('Unesi naziv i valjan URL izvornog oglasa.')
                for evidence in (legal_source, valuation, planning):
                    if evidence and not valid_url(evidence): raise ValueError('Dokazi moraju biti valjani http/https URL-ovi.')
                if legal == 'Uredno' and not legal_source: raise ValueError('Za status Uredno potreban je dokaz pravne provjere.')
                if value is not None and not valuation: raise ValueError('Za tržišnu procjenu potreban je URL dokaza.')
                if buildable == 'Da' and not planning: raise ValueError('Za potvrđenu gradnju potreban je URL dokaza.')
                if until: datetime.strptime(until, '%Y-%m-%d')
                fields = dict(country=country, city=city.strip(), region=region.strip(), title=title.strip(), property_type=None if kind=='Nepoznato' else kind, condition=None if condition=='Nepoznato' else condition, price=price, area=area, renovation=renovation, other_costs=other, estimated_value=value, source=source.strip(), legal=legal, legal_evidence_url=legal_source.strip() or None, valuation_evidence_url=valuation.strip() or None, buildable=buildable, planning_evidence_url=planning.strip() or None, available_until=until or None, updated=datetime.now(timezone.utc).isoformat())
                if selected is None:
                    c.execute('INSERT INTO properties('+','.join(fields)+') VALUES('+','.join('?' for _ in fields)+')', tuple(fields.values()))
                else:
                    c.execute('UPDATE properties SET '+','.join(k+'=?' for k in fields)+' WHERE id=?', tuple(fields.values())+(selected,))
                refresh_matches(c); c.commit(); st.rerun()
            except ValueError as error: st.error(str(error))


def investor_form(c, investors, countries):
    selected = st.selectbox('Novi kupac ili uređivanje zahtjeva', [None]+[i['id'] for i in investors], format_func=lambda x: 'Novi kupac' if x is None else next(i['name'] for i in investors if i['id']==x), key='investor_edit')
    i = next((i for i in investors if i['id']==selected), {})
    if i.get('country'): i=dict(i,country=country_name(i['country']))
    criteria = parse_criteria(i)
    with st.form('buyer_' + str(selected)):
        name = st.text_input('Naziv kupca / tvrtke', value=i.get('name') or '')
        buyer_kinds = ['Građevinska tvrtka', 'Privatna osoba', 'Investicijska tvrtka', 'Javno tijelo', 'Drugo']
        # Keep a known classification; an unknown one is never guessed.
        known_kind = criteria.get('buyer_kind')
        if known_kind and known_kind not in buyer_kinds: buyer_kinds.append(known_kind)
        buyer_kind = st.selectbox('Profil kupca', buyer_kinds, index=buyer_kinds.index(known_kind) if known_kind else 0)
        # The seat may be outside the EU; the EU interest below is a separate choice.
        seats = countries + ([i['country']] if i.get('country') and i['country'] not in countries else [])
        country = st.selectbox('Sjedište', seats, index=seats.index(i['country']) if i.get('country') in seats else 0)
        # Unknown stays unknown (NULL); only a new empty form starts the minimum at 0.
        low = st.number_input('Minimalni ukupni budžet EUR', min_value=0.0, value=float(i['min_budget']) if i.get('min_budget') is not None else (0.0 if selected is None else None))
        high = st.number_input('Maksimalni ukupni budžet EUR', min_value=0.0, value=float(i['max_budget']) if i.get('max_budget') is not None else None, help='Prazno = nepoznat budžet; par tada ostaje kandidat.')
        prefs = st.multiselect('Zanimljive države', countries, default=[country_name(x) for x in (i.get('preferred_countries') or '').split(',') if country_name(x) in countries])
        types = st.multiselect('Tražene vrste nekretnina', PROPERTY_TYPES, default=[v for v in criteria.get('property_types', []) if v in PROPERTY_TYPES])
        conditions = st.multiselect('Prihvatljivo stanje / obnova / rušenje', CONDITIONS, default=[v for v in criteria.get('conditions', []) if v in CONDITIONS])
        st.caption('Ako prihvaća sve vrste ili sva stanja, označi sve. Prazan odabir znači da zahtjev nije poznat.')
        cities = st.text_input('Traženi gradovi, odvojeni zarezom (prazno = bez ograničenja)', value=', '.join(criteria.get('cities', [])))
        regions = st.text_input('Tražene regije / županije, odvojene zarezom (prazno = bez ograničenja)', value=', '.join(criteria.get('regions', [])))
        mina = st.number_input('Minimalna površina m² (neobavezno)', min_value=0.0, value=float(criteria['min_area']) if criteria.get('min_area') is not None else None)
        maxa = st.number_input('Maksimalna površina m² (neobavezno)', min_value=0.0, value=float(criteria['max_area']) if criteria.get('max_area') is not None else None)
        minroi = st.number_input('Minimalni jednostavni ROI % (neobavezno)', min_value=0.0, value=float(criteria['min_roi']) if criteria.get('min_roi') is not None else None)
        buildable = st.checkbox('Traži dokazanu mogućnost planirane gradnje', value=bool(criteria.get('requires_buildable')))
        notes = st.text_area('Dodatni uvjeti / napomene', value=i.get('notes') or '')
        st.caption('Dodatni uvjeti iz napomena provjeravaju se ručno; ne ulaze u automatsku ocjenu.')
        # A dated check with evidence covers exactly this note text; any later change needs a new check.
        if notes.strip() and check_valid(criteria.get('notes_check'), notes):
            st.caption('Provjera dodatnih uvjeta vrijedi: ' + criteria['notes_check']['checked_at'][:10] + ' · ' + criteria['notes_check']['evidence'])
        elif criteria.get('notes_check'):
            st.caption('Ranija provjera ne vrijedi: bilješka je promijenjena ili je provjera starija od 90 dana.')
        notes_confirm = st.checkbox('Dodatni uvjeti iz trenutne bilješke provjereni su uz dokaz', value=False)
        notes_evidence = st.text_input('Dokaz provjere dodatnih uvjeta (izvor, kanal, datum)', value='')
        source = st.text_input('URL dokaza zahtjeva kupca', value=criteria.get('source_url') or '')
        checked = st.text_input('Datum provjere zahtjeva (YYYY-MM-DD)', value=(criteria.get('checked_at') or '')[:10])
        verified = st.checkbox('Zahtjev i kriteriji kupca potvrđeni su na navedenom izvoru', value=bool(i.get('verified')))
        if st.form_submit_button('Spremi kupca i kriterije'):
            try:
                if not name.strip(): raise ValueError('Unesi naziv kupca.')
                if (high is not None and high <= 0) or (high is not None and low is not None and high < low): raise ValueError('Unesi valjan raspon ukupnog budžeta ili ostavi nepoznat iznos prazan.')
                stamp = datetime.strptime(checked, '%Y-%m-%d').replace(tzinfo=timezone.utc).isoformat() if checked else None
                if stamp and datetime.fromisoformat(stamp).date() > datetime.now(timezone.utc).date(): raise ValueError('Datum provjere ne smije biti u budućnosti.')
                if verified and (not source or not stamp or not prefs or not types or not conditions): raise ValueError('Za potvrđen zahtjev navedi izvor, datum, države, vrste i prihvatljiva stanja.')
                if notes_confirm and (not notes.strip() or not notes_evidence.strip()): raise ValueError('Za provjeru dodatnih uvjeta upiši bilješku i dokaz provjere.')
                # Change only the fields this form manages; source keys such as call state stay.
                criteria = {k: v for k, v in criteria.items() if k != '_invalid'}
                criteria.update(buyer_kind=buyer_kind,property_types=types,conditions=conditions,cities=[v.strip() for v in cities.split(',') if v.strip()],regions=[v.strip() for v in regions.split(',') if v.strip()],min_area=mina,max_area=maxa,min_roi=minroi,requires_buildable=buildable,source_url=source.strip(),checked_at=stamp)
                if notes_confirm: criteria['notes_check'] = dict(digest=digest(notes), checked_at=datetime.now(timezone.utc).isoformat(), evidence=notes_evidence.strip())
                validate_criteria(criteria)
                fields = dict(name=name.strip(),country=country,min_budget=low,max_budget=high,preferred_countries=','.join(prefs),notes=notes,verified=int(verified),criteria_json=json.dumps(criteria,ensure_ascii=False))
                if selected is None:
                    c.execute('INSERT INTO investors('+','.join(fields)+') VALUES('+','.join('?' for _ in fields)+')', tuple(fields.values()))
                else:
                    c.execute('UPDATE investors SET '+','.join(k+'=?' for k in fields)+' WHERE id=?',tuple(fields.values())+(selected,))
                refresh_matches(c); c.commit(); st.rerun()
            except ValueError as error: st.error(str(error))
