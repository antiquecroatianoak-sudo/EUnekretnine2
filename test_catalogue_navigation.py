import json
import unittest
from property_connector import links
from registry_discovery import Page, objects


class NavigationTests(unittest.TestCase):
    def discover(self, text):
        return links(Page(text),'https://agency.example/',objects,
                     lambda u,r:u,'https://agency.example/')

    def test_breadcrumbs_do_not_become_listing_links(self):
        graph={'@type':'BreadcrumbList','itemListElement':[
            {'@type':'ListItem','item':'https://agency.example/home'},
            {'@type':'ListItem','item':'https://agency.example/about'}]}
        self.assertEqual(self.discover('<script type="application/ld+json">'+json.dumps(graph)+'</script>'),[])

    def test_property_and_itemlist_evidence_are_discovered(self):
        graph=[{'@type':'Apartment','url':'/flat/1234'},
               {'@type':'ItemList','itemListElement':[
                   {'@type':'ListItem','item':{'url':'/flat/5678'}}]}]
        found=self.discover('<script type="application/ld+json">'+json.dumps(graph)+'</script>')
        self.assertEqual(set(found),{'https://agency.example/flat/1234','https://agency.example/flat/5678'})

    def test_observed_management_and_guide_urls_do_not_consume_detail_budget(self):
        text=''.join('<a href="'+u+'">'+label+'</a>' for u,label in [
            ('/property-management-inowai/','Property management'),
            ('/required-documents-for-sale-of-property','For sale documents'),
            ('/vacancies/property-management-executive/','Property management'),
            ('/property/1234','House for sale'),
            ('/property/5678','House for rent')])
        self.assertEqual(self.discover(text),['https://agency.example/property/1234'])


if __name__=='__main__':unittest.main()
