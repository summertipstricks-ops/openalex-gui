import router from "./router";
import store from "./store";
import {
    filtersAsUrlStr,
    filtersFromUrlStr,
    splitFilterString,
    createSimpleFilter,
    deleteOptionFromFilterValue,
    optionsFromString,
    addOptionToFilterValue,
    toggleOptionIsNegated,
    getMatchModeFromSelectFilterValue,
    optionsToString,
} from "./filterConfigs";
import { getEntityConfig } from "@/entityConfigs";
import * as openalexId from "@/openalexId";
import { getActionConfig, getActionDefaultsStr, getActionDefaultValues } from "@/actionConfigs";
import { getFacetConfig } from "@/facetConfigUtils";
import { urlBase } from "@/apiConfig";

/* =========================================================
   🌍 COUNTRY FILTER (AFGHANISTAN GLOBAL SCOPE)
   ========================================================= */

const COUNTRY_CODE = import.meta.env.VITE_COUNTRY; // e.g. "AF"

const applyCountryFilter = (query) => {
    if (!COUNTRY_CODE) return;

    const countryFilter = institutions.country_code:${COUNTRY_CODE};

    if (query.filter) {
        query.filter = query.filter + "," + countryFilter;
    } else {
        query.filter = countryFilter;
    }
};

/* ========================================================= */

const urlObjectFromSearchUrl = function (searchUrl) {
    const query = Object.fromEntries(new URL(searchUrl).searchParams);
    const entityType = "works"; 
    return {
        name: "Serp",
        params: { entityType },
        query,
    };
};

const pushSearchUrlToRoute = async function (router, searchUrl) {
    await pushToRoute(router, urlObjectFromSearchUrl(searchUrl));
};

const routeFromOxurl = function (oxurl) {
    if (!oxurl) return null;
    try {
        const parsed = new URL(oxurl, urlBase.api);
        const entityType = parsed.pathname.split('/').filter(Boolean)[0] || 'works';
        const query = Object.fromEntries(parsed.searchParams);
        return {
            name: "Serp",
            params: { entityType },
            query,
        };
    } catch (e) {
        return null;
    }
};

/* =========================================================
   CHIP FILTER CORE
   ========================================================= */

const stripSearchClauses = function (filterStr) {
    if (!filterStr) return filterStr;
    const kept = splitFilterString(filterStr).filter(clause => {
        let key = clause.split(":")[0];
        if (key.startsWith("!")) key = key.slice(1);
        return key !== "search" && !key.endsWith(".search");
    });
    return kept.join(",");
};

const chipFilterStr = function (currentRoute) {
    const routeFilter = currentRoute?.query?.filter;
    if (store.state.isLoading) return routeFilter;

    const xqUrl = store.state.resultsObject?.meta?.x_query?.url;
    if (!xqUrl) return routeFilter;

    const xqRoute = routeFromOxurl(xqUrl);
    if (!xqRoute) return routeFilter;

    if (xqRoute.params.entityType !== currentRoute?.params?.entityType) {
        return routeFilter;
    }

    return stripSearchClauses(xqRoute.query.filter) || undefined;
};

/* =========================================================
   ROUTING HELPERS
   ========================================================= */

const pushToRoute = async function (router, newRoute) {
    const enrichedRoute = addPersistentParams(newRoute);
    return await router.push(enrichedRoute).catch(e => {
        if (e.name !== "NavigationDuplicated") throw e;
    });
};

const replaceToRoute = async function (router, newRoute) {
    const enrichedRoute = addPersistentParams(newRoute);
    return await router.replace(enrichedRoute).catch(e => {
        if (e.name !== "NavigationDuplicated") throw e;
    });
};

/* =========================================================
   ADD COUNTRY FILTER HERE (IMPORTANT CHANGE)
   ========================================================= */
   const makeApiUrl = function (currentRoute, formatCsv, groupBy) {
    const entityType = currentRoute.params.entityType;
    const filtersFromUrl = filtersFromUrlStr(entityType, currentRoute.query.filter);
    const filterString = filtersAsUrlStr(filtersFromUrl);

    const query = {
        filter: filterString,
    };

    // ⭐️ APPLY AFGHANISTAN FILTER HERE
    applyCountryFilter(query);

    if (formatCsv) query.format = "csv";
    if (groupBy) {
        query.group_by = groupBy;
    } else {
        query.page = currentRoute.query.page;
        query.sort = currentRoute.query.sort ?? "cited_by_count:desc";
        query.per_page = getPerPage();
    }

    if (currentRoute.query.include_xpac === 'true') {
        query.include_xpac = 'true';
    }

    searchParamKeys.forEach(k => {
        if (currentRoute.query[k]) query[k] = currentRoute.query[k];
    });

    const apiUrl = new URL(urlBase.api);
    apiUrl.pathname = entityType;

    const validQueryKeys = [
        "page",
        "filter",
        "group_by",
        "sort",
        "format",
        "per_page",
        "include_xpac",
        ...searchParamKeys,
    ];

    const searchParams = new URLSearchParams();
    validQueryKeys.forEach(k => {
        if (query[k] !== undefined && query[k] !== "") {
            searchParams.set(k, query[k]);
        }
    });

    apiUrl.search = decodeURIComponent(searchParams.toString());
    return apiUrl.toString().replace("mailto=ui%40openalex.org", "mailto=ui@openalex.org");
};

/* =========================================================
   SEARCH PARAMS
   ========================================================= */

const searchParamKeys = [
    'search', 'search.exact', 'search.semantic',
    'search.title', 'search.title.exact',
    'search.title_and_abstract', 'search.title_and_abstract.exact',
];

/* =========================================================
   EXPORT (REST OF FILE UNCHANGED)
   ========================================================= */

export const url = {
    pushToRoute,
    replaceToRoute,
    pushSearchUrlToRoute,
    routeFromOxurl,
    chipFilterStr,
    makeApiUrl,
};
