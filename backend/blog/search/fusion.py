RRF_K = 60  # Standard reciprocal-rank-fusion constant.


def rrf_merge(rankings):
    """Merge ranked lists with reciprocal rank fusion.

    ``rankings`` maps a ranker name (e.g. "keyword") to its keys, best first. Returns
    ``[(key, score, [ranker names that found it])]`` best first; ties keep first-seen order.
    """
    scores, found_by = {}, {}
    for name, keys in rankings.items():
        for rank, key in enumerate(keys):
            scores[key] = scores.get(key, 0.0) + 1.0 / (RRF_K + rank + 1)
            found_by.setdefault(key, []).append(name)
    return sorted(((key, scores[key], found_by[key]) for key in scores), key=lambda item: item[1], reverse=True)
