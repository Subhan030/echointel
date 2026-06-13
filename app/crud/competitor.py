from typing import List, Optional
from app.store import store, Competitor

def get_competitor(competitor_id: int) -> Optional[Competitor]:
    return store.competitors.get(competitor_id)

def get_competitors(skip: int = 0, limit: int = 100) -> List[Competitor]:
    comps = list(store.competitors.values())
    return comps[skip : skip + limit]

def create_competitor(competitor_data: dict) -> Competitor:
    comp_id = store.next_competitor_id()
    new_comp = Competitor(id=comp_id, **competitor_data)
    store.competitors[comp_id] = new_comp
    return new_comp

def update_competitor(competitor_id: int, update_data: dict) -> Optional[Competitor]:
    comp = get_competitor(competitor_id)
    if comp:
        for key, value in update_data.items():
            setattr(comp, key, value)
    return comp
