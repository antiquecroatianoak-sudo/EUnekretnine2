"""Explicit record-bound inquiry invitations, not partnership or marketing consent."""
from urllib.parse import urlsplit, urljoin
import re

def emporia_inquiry(url, title, page, checked_at):
    # Reviewed site-specific form contract. Never infer a route from a footer
    # phone, a generic portal contact, or a form for a related listing.
    parsed=urlsplit(url)
    if parsed.scheme!='https' or parsed.netloc!='www.emporia-realestate.com':return None
    if not re.fullmatch(r'/property/[^/]+/',parsed.path):return None
    if page.meta.get('og:url')!=url or page.meta.get('og:title')!=title:return None
    normalize=lambda text:' '.join(re.sub(r'[\u2010-\u2015\u2212]','-',text).split())
    for form in getattr(page,'forms',[]):
        fields=form['fields']
        if fields.get('listing_url')!=url or normalize(fields.get('listing_title',''))!=normalize(title):continue
        action=urlsplit(urljoin(url,form['action']))
        if (action.scheme,action.netloc,action.path)!=(parsed.scheme,parsed.netloc,parsed.path):continue
        if not {'your-email','your-message'}<=fields.keys() or not form['submit']:continue
        return dict(mode='agency',name='Emporia d.o.o. Zadar',agency_name='Emporia d.o.o. Zadar',
                    record_reference=url,evidence_url=url,contact_url=url,represents_record=True,permitted=True,
                    permission_scope='property_enquiry_only',
                    permission_quote='Your Message',permission_basis='record_bound_inquiry_form',
                    checked_at=checked_at)
    return None
