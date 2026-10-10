import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Building2,
  MapPin,
  Stethoscope,
  Bed,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  HelpCircle,
  AlertCircle,
  ArrowRight,
  RotateCcw,
  CheckCircle2,
  Search,
  X,
  Star,
  SlidersHorizontal,
  ChevronDown,
  Bookmark,
  ExternalLink,
  AlertOctagon,
  Navigation,
  LocateFixed,
  Sparkles,
  Award,
  Compass,
  Cpu
} from 'lucide-react';
import { getGoogleMapsUrl } from '../utils/maps';
import { useAuth } from '../context/AuthContext';
import {
  fetchCities,
  fetchTaxonomy,
  searchHospitals,
  fetchNearestHospitalsGuidance
} from '../services/hospitalApi';
import BillBreakdownModal from '../components/BillBreakdownModal';
import ScoreBreakdownModal from '../components/ScoreBreakdownModal';
import WhyNoEstimateModal from '../components/WhyNoEstimateModal';
import ProvenanceBadge from '../components/ProvenanceBadge';
import WhyThisEstimateCard from '../components/WhyThisEstimateCard';
import ScenarioRecalculator from '../components/ScenarioRecalculator';
import {
  getHospitalCoordinates,
  calculateDistanceKm,
  detectLocalityLabel,
  getNearestCity,
  resolveProximityOrigin,
  CITY_LOCALITIES
} from '../utils/geoCoordinates';

function formatINR(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount || 0);
}

function HighlightText({ text, highlight }) {
  if (!highlight || !highlight.trim() || !text) {
    return <>{text}</>;
  }
  const escaped = highlight.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === highlight.trim().toLowerCase() ? (
          <mark key={i} style={{ background: '#fef08a', padding: '0 2px', borderRadius: '2px' }}>
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

const CITY_QUICK_LOCALITIES = {
  bengaluru: [
    'Whitefield', 'Indiranagar', 'Koramangala', 'Jayanagar',
    'Hebbal', 'Bannerghatta', 'Rajajinagar', 'Malleshwaram',
    'Electronic City', 'Yelahanka', 'HSR Layout', 'Marathahalli'
  ],
  bangalore: [
    'Whitefield', 'Indiranagar', 'Koramangala', 'Jayanagar',
    'Hebbal', 'Bannerghatta', 'Rajajinagar', 'Malleshwaram'
  ],
  hyderabad: [
    'Banjara Hills', 'Jubilee Hills', 'Gachibowli', 'Hitec City',
    'Secunderabad', 'Kukatpally', 'Madhapur', 'Kondapur',
    'Ameerpet', 'Begumpet', 'Somajiguda', 'Uppal', 'LB Nagar'
  ],
  pune: [
    'Dighi', 'Bhosari', 'Viman Nagar', 'Kothrud',
    'Hinjewadi', 'Baner', 'Hadapsar', 'Aundh', 'Shivajinagar', 'Wakad'
  ],
  mumbai: [
    'Andheri', 'Bandra', 'Dadar', 'Borivali', 'Goregaon', 'Powai', 'Thane', 'Navi Mumbai'
  ],
  delhi: [
    'Connaught Place', 'Saket', 'Rohini', 'Dwarka', 'South Extension', 'Noida', 'Gurugram'
  ],
  chennai: [
    'T Nagar', 'Adyar', 'Velachery', 'Anna Nagar', 'Mylapore', 'Guindy', 'Kilpauk', 'Alwarpet', 'Porur', 'Tambaram', 'Vadapalani'
  ],
  kolkata: [
    'Park Street', 'Salt Lake', 'New Town', 'Ballygunge', 'Alipore', 'Howrah', 'Jadavpur', 'Dum Dum'
  ],
  ahmedabad: [
    'Navrangpura', 'Satellite', 'Bodakdev', 'Vastrapur', 'SG Highway', 'Maninagar', 'Paldi', 'Bopal'
  ],
  jaipur: [
    'Malviya Nagar', 'Vaishali Nagar', 'Mansarovar', 'C Scheme', 'Raja Park', 'Tonk Road'
  ],
  lucknow: [
    'Gomti Nagar', 'Hazratganj', 'Aliganj', 'Indira Nagar', 'Alambagh', 'Mahanagar'
  ]
};

export default function HospitalDiscoveryPage({
  policy,
  onBackToPolicy,
  onResetPolicy,
  onTrackJourney,
  onRequireAuth,
  onViewMethodology,
  onDiscoveryContextChange
}) {
  const { t } = useTranslation();
  const { user, isHospitalSaved, toggleSaveHospital } = useAuth();

  // Filters
  const [selectedCity, setSelectedCity] = useState('');
  const [cityInput, setCityInput] = useState('');
  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);
  const cityDropdownRef = useRef(null);
  const procedureSelectRef = useRef(null);
  const specialtySelectRef = useRef(null);
  const [selectedSpecialty, setSelectedSpecialty] = useState('');
  const [selectedProcedure, setSelectedProcedure] = useState('');
  const [selectedRoom, setSelectedRoom] = useState('General Ward');
  const [networkOnly, setNetworkOnly] = useState(() => Boolean(policy?.insurer));

  // Metadata
  const [cities, setCities] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [proceduresMap, setProceduresMap] = useState({});
  const [procedureMetaMap, setProcedureMetaMap] = useState({});
  const [availableProcedures, setAvailableProcedures] = useState([]);

  // Results & Explicit Counts (Section 4, 12)
  const [hospitals, setHospitals] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [networkFacilityCount, setNetworkFacilityCount] = useState(0);
  const [specialtyMatchedCount, setSpecialtyMatchedCount] = useState(0);
  const [procedureMatchedCount, setProcedureMatchedCount] = useState(0);
  const [networkStatusMessage, setNetworkStatusMessage] = useState(null);
  const [cityAverageCost, setCityAverageCost] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Search & Sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('coverageFit');

  // Default sort is always Best Coverage Fit
  // User can manually toggle to specialtyFit if desired

  // Geolocation & AI Guidance State
  const [userLocation, setUserLocation] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [nearestGuidance, setNearestGuidance] = useState(null);
  const [isLoadingGuidance, setIsLoadingGuidance] = useState(false);

  const handleToggleLocation = () => {
    if (userLocation) {
      setUserLocation(null);
      if (sortBy === 'nearestFirst') {
        setSortBy('coverageFit');
      }
      return;
    }

    setIsLocating(true);

    const setFallbackAIT = () => {
      setUserLocation({
        latitude: 18.6183,
        longitude: 73.8768,
        localityName: 'AIT Pune Campus (Dighi Hills)',
        isFallback: true
      });
      setSelectedCity('Pune');
      setCityInput('Pune');
      setSortBy('nearestFirst');
      setIsLocating(false);
    };

    if (!navigator.geolocation) {
      setFallbackAIT();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        try {
          const latitude = pos.coords.latitude;
          const longitude = pos.coords.longitude;
          const accuracy = pos.coords.accuracy || 50;
          const detectedCity = getNearestCity(latitude, longitude);

          // Check distance to AIT Pune (18.6183, 73.8768)
          const distToAIT = calculateDistanceKm(latitude, longitude, 18.6183, 73.8768);
          const isAITVicinity = distToAIT != null && distToAIT <= 2.8;

          // If on a campus desktop network where browser IP geolocation is coarse (>300m),
          // snap to the ground-truth AIT campus coordinates (18.6183, 73.8768)
          const finalLat = (isAITVicinity && accuracy > 300) ? 18.6183 : latitude;
          const finalLng = (isAITVicinity && accuracy > 300) ? 73.8768 : longitude;

          const localityName = isAITVicinity
            ? 'AIT Pune Campus (GPS Active)'
            : detectedCity.toLowerCase() === 'pune'
            ? 'Pune (GPS Active)'
            : `${detectedCity} (GPS Active)`;

          setUserLocation({
            latitude: finalLat,
            longitude: finalLng,
            localityName,
            isFallback: false
          });

          // Always auto-select the detected city so the page immediately loads local hospitals!
          setSelectedCity(detectedCity);
          setCityInput(detectedCity);
          setSortBy('nearestFirst');
        } catch (err) {
          console.warn('Error setting detected location:', err);
          setFallbackAIT();
        } finally {
          setIsLocating(false);
        }
      },
      (err) => {
        console.warn('Geolocation unavailable/denied, defaulting to AIT Pune Campus:', err);
        setFallbackAIT();
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  const handleSetAITLocation = () => {
    setUserLocation({
      latitude: 18.6183,
      longitude: 73.8768,
      localityName: 'AIT Pune Campus (Dighi Hills)',
      isFallback: false
    });
    setSelectedCity('Pune');
    setCityInput('Pune');
    setSortBy('nearestFirst');
  };

  // Pagination
  const [displayCount, setDisplayCount] = useState(12);

  // Modals
  const [selectedHospitalForModal, setSelectedHospitalForModal] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedScoreForModal, setSelectedScoreForModal] = useState(null);
  const [selectedWhyNoEstimateModal, setSelectedWhyNoEstimateModal] = useState(null);

  const handleFocusProcedureSelect = () => {
    if (procedureSelectRef.current) {
      procedureSelectRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      procedureSelectRef.current.focus();
    }
  };

  const handleFocusSpecialtySelect = () => {
    if (specialtySelectRef.current) {
      specialtySelectRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      specialtySelectRef.current.focus();
    }
  };

  // Click outside to close city dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (cityDropdownRef.current && !cityDropdownRef.current.contains(event.target)) {
        setIsCityDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch additional matching cities dynamically as user types
  useEffect(() => {
    const q = cityInput.trim().toLowerCase();
    if (!q || q.length < 2) return;
    const timer = setTimeout(async () => {
      try {
        const remote = await fetchCities(q);
        if (remote && remote.length > 0) {
          setCities((prev) => {
            const map = new Map(prev.map((c) => [c.name.toLowerCase(), c]));
            remote.forEach((r) => map.set(r.name.toLowerCase(), r));
            return Array.from(map.values()).sort((a, b) => b.count - a.count);
          });
        }
      } catch (err) {
        console.warn('City search error:', err);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [cityInput]);

  // Compute live matching cities according to current input text
  const matchingCities = useMemo(() => {
    const q = cityInput.trim().toLowerCase();
    if (!q) {
      return cities.slice(0, 15);
    }
    return cities
      .filter((c) => c.name.toLowerCase().includes(q))
      .slice(0, 30);
  }, [cities, cityInput]);

  const handleSelectCity = (cityName) => {
    setCityInput(cityName);
    setSelectedCity(cityName);
    setIsCityDropdownOpen(false);
    setSortBy('coverageFit');
    if (userLocation && userLocation.latitude != null && userLocation.longitude != null) {
      const userCity = getNearestCity(userLocation.latitude, userLocation.longitude);
      const isSame = userCity.toLowerCase() === cityName.toLowerCase() ||
        (userCity.toLowerCase() === 'bangalore' && cityName.toLowerCase() === 'bengaluru') ||
        (userCity.toLowerCase() === 'bengaluru' && cityName.toLowerCase() === 'bangalore');
      if (!isSame) {
        setUserLocation(null);
      }
    }
  };

  const handleClearCity = () => {
    setCityInput('');
    setSelectedCity('');
    setIsCityDropdownOpen(false);
  };

  const handleCityKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (matchingCities.length > 0) {
        handleSelectCity(matchingCities[0].name);
      } else if (cityInput.trim()) {
        handleSelectCity(cityInput.trim());
      }
    } else if (e.key === 'Escape') {
      setIsCityDropdownOpen(false);
    }
  };

  // Load initial cities & taxonomy
  useEffect(() => {
    async function loadMeta() {
      try {
        const [citiesData, taxData] = await Promise.all([
          fetchCities(),
          fetchTaxonomy()
        ]);
        setCities(citiesData);
        setSpecialties(taxData.specialties || []);
        setProceduresMap(taxData.proceduresBySpecialty || {});
        setProcedureMetaMap(taxData.procedureMetadata || {});
      } catch (err) {
        console.error('Failed to load clinical metadata:', err);
      }
    }
    loadMeta();
  }, []);

  // Update available procedures when specialty changes
  useEffect(() => {
    if (selectedSpecialty && proceduresMap[selectedSpecialty]) {
      setAvailableProcedures(proceduresMap[selectedSpecialty]);
      if (selectedProcedure && !proceduresMap[selectedSpecialty].includes(selectedProcedure)) {
        setSelectedProcedure('');
      }
    } else {
      setAvailableProcedures([]);
      setSelectedProcedure('');
    }
  }, [selectedSpecialty, proceduresMap]);

  // Execute search whenever primary filters change
  useEffect(() => {
    if (!selectedCity || !selectedCity.trim()) {
      setHospitals([]);
      setTotalCount(0);
      setNetworkFacilityCount(0);
      setSpecialtyMatchedCount(0);
      setProcedureMatchedCount(0);
      setNetworkStatusMessage(null);
      setCityAverageCost(0);
      setLoading(false);
      return;
    }

    const timer = setTimeout(() => {
      performSearch();
    }, 350);

    return () => clearTimeout(timer);
  }, [selectedCity, selectedSpecialty, selectedProcedure, selectedRoom, networkOnly]);

  const performSearch = async () => {
    if (!selectedCity || !selectedCity.trim()) {
      setHospitals([]);
      setTotalCount(0);
      setNetworkFacilityCount(0);
      setSpecialtyMatchedCount(0);
      setProcedureMatchedCount(0);
      setNetworkStatusMessage(null);
      setCityAverageCost(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const canonicalId = selectedProcedure && procedureMetaMap[selectedProcedure]?.canonicalId
        ? procedureMetaMap[selectedProcedure].canonicalId
        : undefined;

      const res = await searchHospitals({
        policyId: policy._id,
        policy,
        city: selectedCity.trim(),
        specialty: selectedSpecialty || undefined,
        procedure: selectedProcedure || undefined,
        canonicalProcedureId: canonicalId,
        roomType: selectedRoom,
        networkOnly: Boolean(policy?.insurer) || networkOnly
      });

      setHospitals(res.hospitals || []);
      setTotalCount(res.totalCount || 0);
      setNetworkFacilityCount(res.networkFacilityCount || 0);
      setSpecialtyMatchedCount(res.specialtyMatchedCount || 0);
      setProcedureMatchedCount(res.procedureMatchedCount || 0);
      setNetworkStatusMessage(res.message || null);
      setCityAverageCost(res.cityAverageCost || 0);
      setDisplayCount(12);
    } catch (err) {
      console.error('Search error:', err);
      setError(err.message || 'Failed to search hospitals.');
    } finally {
      setLoading(false);
    }
  };

  const handleClearFilters = () => {
    setSelectedCity('');
    setCityInput('');
    setIsCityDropdownOpen(false);
    setSelectedSpecialty('');
    setSelectedProcedure('');
    setSelectedRoom('General Ward');
    setNetworkOnly(Boolean(policy?.insurer));
    setSearchQuery('');
    setTypeFilter('all');
    setSortBy('coverageFit');
    setHospitals([]);
    setTotalCount(0);
    setNetworkFacilityCount(0);
    setSpecialtyMatchedCount(0);
    setProcedureMatchedCount(0);
    setNetworkStatusMessage(null);
    setUserLocation(null);
  };

  // Resolve active proximity origin (Locality in searchQuery, or user GPS if in same city, or city center)
  const activeProximityOrigin = useMemo(() => {
    return resolveProximityOrigin({
      selectedCity,
      searchQuery,
      userLocation
    });
  }, [selectedCity, searchQuery, userLocation]);

  // Enrich hospitals with realistic geo-coordinates and user distance in km
  const enrichedHospitals = useMemo(() => {
    if (!Array.isArray(hospitals)) return [];
    return hospitals
      .map((item) => {
        if (!item) return null;
        const h = item.hospital || item;
        if (!h) return null;
        const coords = getHospitalCoordinates(h, selectedCity || 'Pune');
        const distanceKm =
          activeProximityOrigin && coords
            ? calculateDistanceKm(activeProximityOrigin.latitude, activeProximityOrigin.longitude, coords.latitude, coords.longitude)
            : null;
        const localityLabel = coords?.locality || detectLocalityLabel(h.address, selectedCity || 'Pune') || '';

        return {
          ...item,
          hospital: item.hospital || h,
          coordinates: coords,
          distanceKm,
          localityLabel
        };
      })
      .filter(Boolean);
  }, [hospitals, activeProximityOrigin, selectedCity]);

  // Dynamic & Curated Localities strictly for the currently selected city
  const cityLocalities = useMemo(() => {
    if (!selectedCity || !selectedCity.trim()) return [];
    const normCity = selectedCity.trim().toLowerCase();

    // 1. Check curated list for this city
    if (CITY_QUICK_LOCALITIES[normCity] && CITY_QUICK_LOCALITIES[normCity].length > 0) {
      return CITY_QUICK_LOCALITIES[normCity];
    }

    // 2. Fallback to CITY_LOCALITIES keys for this city if defined
    const table = CITY_LOCALITIES[normCity] || (normCity === 'bangalore' ? CITY_LOCALITIES.bengaluru : null);
    if (table) {
      return Object.keys(table)
        .slice(0, 10)
        .map((k) => k.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '));
    }

    // 3. Dynamically extract top localities from loaded hospitals for ANY city!
    if (enrichedHospitals && enrichedHospitals.length > 0) {
      const counts = {};
      const stopWords = new Set([
        'city', 'district', 'zone', 'hospital', 'nagar', 'road', 'street',
        'near', 'opp', 'behind', 'floor', 'plot', 'phase', 'area', normCity
      ]);

      enrichedHospitals.forEach((item) => {
        const loc = item.localityLabel;
        if (loc && typeof loc === 'string') {
          const cleanLoc = loc.trim();
          const cleanLower = cleanLoc.toLowerCase();
          if (
            cleanLower !== normCity &&
            !cleanLower.startsWith('zone ') &&
            !cleanLower.startsWith('pin ') &&
            !cleanLower.startsWith('city ') &&
            cleanLoc.length >= 3 &&
            !stopWords.has(cleanLower)
          ) {
            counts[cleanLoc] = (counts[cleanLoc] || 0) + 1;
          }
        }
      });

      const dynamicList = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([loc]) => loc);

      if (dynamicList.length > 0) {
        return dynamicList;
      }
    }

    // Strict safety: NEVER return another city's localities!
    return [];
  }, [selectedCity, enrichedHospitals]);

  // Filter & sort
  const filteredHospitals = useMemo(() => {
    let list = [...enrichedHospitals];

    // If an insurer policy is active, strictly filter to hospitals that accept this insurer in all sorting features
    if (policy?.insurer || networkOnly) {
      list = list.filter((item) => item.networkInfo?.networkStatus === 'verified');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((item) => {
        const h = item.hospital;
        const nameMatch = (h.hospital_name || '').toLowerCase().includes(q);
        const addrMatch = (h.address || '').toLowerCase().includes(q);
        const specMatch = (h.specialties || []).some((s) => s.toLowerCase().includes(q));
        return nameMatch || addrMatch || specMatch;
      });
    }

    if (typeFilter === 'topRated') {
      list = list.filter((item) => (item.hospital.rating || 0) >= 4.0);
    } else if (typeFilter === 'private') {
      list = list.filter((item) => (item.hospital.hospital_type || '').toLowerCase() === 'private');
    } else if (typeFilter === 'government') {
      list = list.filter((item) => (item.hospital.hospital_type || '').toLowerCase() === 'government');
    }

    if (sortBy === 'nearestFirst') {
      list.sort((a, b) => {
        const distA = a.distanceKm != null ? a.distanceKm : 99999;
        const distB = b.distanceKm != null ? b.distanceKm : 99999;
        if (distA !== distB) {
          return distA - distB;
        }
        const scoreA = a.score?.granularScore ?? a.score?.finalScore ?? 0;
        const scoreB = b.score?.granularScore ?? b.score?.finalScore ?? 0;
        return scoreB - scoreA;
      });
    } else if (sortBy === 'specialtyFit') {
      if (selectedSpecialty) {
        const specialtyOnlyList = list.filter(
          (item) => item.specialtyNameMatch?.matched || item.specialtyNameRelevance?.matched ||
                    (item.hospital?.specialties || []).some((s) => s.toLowerCase().includes(selectedSpecialty.toLowerCase()))
        );
        if (specialtyOnlyList.length > 0) {
          list = specialtyOnlyList;
        }
      }
      list.sort((a, b) => {
        const aSpec = a.specialtyNameMatch?.score || (a.specialtyNameMatch?.matched ? 80 : 0);
        const bSpec = b.specialtyNameMatch?.score || (b.specialtyNameMatch?.matched ? 80 : 0);
        if (bSpec !== aSpec) return bSpec - aSpec;
        const rA = a.hospital?.rating || 0;
        const rB = b.hospital?.rating || 0;
        if (rB !== rA) return rB - rA;
        return (a.rank || 0) - (b.rank || 0);
      });
    } else if (sortBy === 'coverageFit' || sortBy === 'rank') {
      list.sort((a, b) => {
        const scoreA = a.score?.granularScore ?? a.score?.finalScore ?? 0;
        const scoreB = b.score?.granularScore ?? b.score?.finalScore ?? 0;
        if (scoreB !== scoreA) {
          return scoreB - scoreA;
        }
        const oopA = a.score?.patientPayable ?? 0;
        const oopB = b.score?.patientPayable ?? 0;
        if (oopA !== oopB) {
          return oopA - oopB;
        }
        return (b.hospital?.rating || 0) - (a.hospital?.rating || 0);
      });
    } else {
      list.sort((a, b) => a.rank - b.rank);
    }

    return list;
  }, [enrichedHospitals, searchQuery, typeFilter, sortBy, selectedSpecialty, policy?.insurer, networkOnly]);

  const displayedHospitals = filteredHospitals.slice(0, displayCount);

  // Top 3 Spotlight Hospitals dynamically adapting to active sortBy mode (Coverage, Nearest, Specialty)
  const top3SpotlightHospitals = useMemo(() => {
    if (!enrichedHospitals || enrichedHospitals.length === 0) return [];

    let candidates = enrichedHospitals.filter((item) => {
      const isVerified = item.networkInfo?.networkStatus === 'verified';
      if (policy?.insurer) return isVerified;
      return item.networkInfo?.networkStatus !== 'no_match';
    });

    if (selectedProcedure) {
      const procCandidates = candidates.filter(
        (item) => item.procedureMatch || item.specialtyNameMatch?.matched || item.specialtyNameRelevance?.matched
      );
      if (procCandidates.length > 0) {
        candidates = procCandidates;
      }
    } else if (selectedSpecialty) {
      const specCandidates = candidates.filter(
        (item) => item.specialtyNameMatch?.matched || item.specialtyNameRelevance?.matched ||
                  (item.hospital?.specialties || []).some((s) => s.toLowerCase().includes(selectedSpecialty.toLowerCase()))
      );
      if (specCandidates.length > 0) {
        candidates = specCandidates;
      }
    }

    // Apply searchQuery filter if user has entered or clicked a search/locality term
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const searchMatched = candidates.filter((item) => {
        const h = item.hospital || {};
        const name = (h.hospital_name || '').toLowerCase();
        const addr = (h.address || '').toLowerCase();
        const spec = (h.specialties || []).some((s) => s.toLowerCase().includes(q));
        const loc = (item.localityLabel || '').toLowerCase();
        return name.includes(q) || addr.includes(q) || spec.includes(q) || loc.includes(q);
      });
      if (searchMatched.length > 0) {
        candidates = searchMatched;
      }
    }

    if (sortBy === 'nearestFirst') {
      candidates.sort((a, b) => {
        const distA = a.distanceKm != null ? a.distanceKm : 99999;
        const distB = b.distanceKm != null ? b.distanceKm : 99999;
        if (Math.abs(distA - distB) > 0.05) {
          return distA - distB;
        }
        const scoreA = a.score?.granularScore ?? a.score?.finalScore ?? 0;
        const scoreB = b.score?.granularScore ?? b.score?.finalScore ?? 0;
        return scoreB - scoreA;
      });
    } else if (sortBy === 'specialtyFit') {
      candidates.sort((a, b) => {
        const aSpec = a.specialtyNameMatch?.score || (a.specialtyNameMatch?.matched ? 80 : 0);
        const bSpec = b.specialtyNameMatch?.score || (b.specialtyNameMatch?.matched ? 80 : 0);
        if (bSpec !== aSpec) return bSpec - aSpec;
        const rA = a.hospital?.rating || 0;
        const rB = b.hospital?.rating || 0;
        if (rB !== rA) return rB - rA;
        return (a.rank || 0) - (b.rank || 0);
      });
    } else {
      // coverageFit
      candidates.sort((a, b) => {
        const scoreA = a.score?.granularScore ?? a.score?.finalScore ?? 0;
        const scoreB = b.score?.granularScore ?? b.score?.finalScore ?? 0;
        if (scoreB !== scoreA) return scoreB - scoreA;
        const oopA = a.score?.patientPayable ?? 0;
        const oopB = b.score?.patientPayable ?? 0;
        return oopA - oopB;
      });
    }

    return candidates.slice(0, 3);
  }, [enrichedHospitals, policy?.insurer, selectedProcedure, selectedSpecialty, sortBy, searchQuery]);

  // Fetch SehatSure AI Care guidance dynamically for top 3 spotlight facilities
  useEffect(() => {
    if (!top3SpotlightHospitals || top3SpotlightHospitals.length === 0) {
      setNearestGuidance(null);
      return;
    }

    let isMounted = true;
    const fetchGuidance = async () => {
      setIsLoadingGuidance(true);
      try {
        const payload = {
          policy,
          procedure: selectedProcedure || 'General Procedure',
          specialty: selectedSpecialty || '',
          mode: sortBy,
          hospitals: top3SpotlightHospitals.map((item) => {
            const ci = item.costIntelligence;
            const hasCI = Boolean(ci && ci.available && (item.estimate?.available !== false));
            return {
              name: item.hospital?.hospital_name,
              locality: item.localityLabel || item.hospital?.address,
              networkStatus: item.networkInfo?.networkStatus || 'verified',
              estimatedOOP: hasCI ? (item.score?.patientPayable ?? 0) : null,
              patientPayable: hasCI ? (item.score?.patientPayable ?? 0) : null,
              hasEstimate: hasCI,
              score: Math.round(Number(item.score?.granularScore ?? item.score?.finalScore ?? 95)),
              rating: item.hospital?.rating || 4.2
            };
          })
        };
        const res = await fetchNearestHospitalsGuidance(payload);
        const guidanceData = res?.data || res;
        if (isMounted && guidanceData && (guidanceData.summary || guidanceData.recommendation)) {
          setNearestGuidance(guidanceData);
        }
      } catch (err) {
        console.warn('Could not fetch guidance:', err);
      } finally {
        if (isMounted) {
          setIsLoadingGuidance(false);
        }
      }
    };

    fetchGuidance();

    return () => {
      isMounted = false;
    };
  }, [
    top3SpotlightHospitals.map((item) => item?.hospital?.hospital_name).join(','),
    selectedProcedure,
    selectedSpecialty,
    sortBy,
    policy?.insurer
  ]);

  // Synchronize Discovery context (selected procedure, city, top spotlight hospitals) with global assistant
  useEffect(() => {
    if (typeof onDiscoveryContextChange === 'function') {
      const topHospitals = (top3SpotlightHospitals || []).map((item, idx) => ({
        name: item.hospital?.hospital_name,
        locality: item.localityLabel || item.hospital?.address?.split(',')[0] || selectedCity || 'Pune',
        networkStatus: item.networkInfo?.networkStatus === 'verified'
          ? `100% Cashless Covered (${policy?.insurer || 'In-Network'})`
          : 'In-Network Cashless',
        patientPayable: item.score?.patientPayable ?? item.estimate?.patientPayable ?? 0,
        score: Math.round(Number(item.score?.granularScore ?? item.score?.finalScore ?? 96)),
        rank: idx === 0 ? '1' : idx === 1 ? '2' : '3',
        cashless: true
      }));

      onDiscoveryContextChange({
        city: selectedCity || 'Pune',
        specialty: selectedSpecialty,
        procedureName: selectedProcedure,
        roomCategory: selectedRoom,
        mode: sortBy,
        recommendedHospitals: topHospitals,
        guidanceText: nearestGuidance?.summary || nearestGuidance?.recommendation || ''
      });
    }
  }, [
    selectedCity,
    selectedSpecialty,
    selectedProcedure,
    selectedRoom,
    sortBy,
    top3SpotlightHospitals.map((item) => item?.hospital?.hospital_name).join(','),
    nearestGuidance?.summary,
    policy?.insurer
  ]);

  const isCurrentSpecialtyExcluded = Boolean(
    selectedSpecialty &&
    policy?.exclusions &&
    Array.isArray(policy.exclusions) &&
    policy.exclusions.some((ex) => {
      const normEx = String(ex).toLowerCase().trim();
      const normSpec = selectedSpecialty.toLowerCase().trim();
      return normEx === normSpec || normSpec.includes(normEx) || normEx.includes(normSpec);
    })
  );

  const openBreakdownModal = (item) => {
    setSelectedHospitalForModal(item);
    setIsModalOpen(true);
  };

  const isSpecialtyMode = sortBy === 'specialtyFit';
  const isNearestMode = sortBy === 'nearestFirst';
  const isCoverageMode = sortBy === 'coverageFit';

  // Mode-specific visual presentation & AI guidance titles (NO "Gemini" branding)
  const modeConfig = useMemo(() => {
    if (isSpecialtyMode) {
      return {
        badgeIcon: <Stethoscope size={13} />,
        badgeText: 'SehatSure Specialty Clinical Fit',
        badgeBg: '#f5f3ff',
        badgeColor: '#6d28d9',
        badgeBorder: '#ddd6fe',
        title: selectedSpecialty
          ? `Top Specialty Centers for ${selectedSpecialty}`
          : selectedProcedure
          ? `Top Clinical Facilities for ${selectedProcedure}`
          : 'SehatSure Specialty Centers of Excellence',
        subtitle: selectedSpecialty
          ? `Ranked by clinical department volume, surgeon ratings, and verified ${policy?.insurer || 'cashless'} coverage.`
          : 'Showing verified in-network clinical centers ranked by specialized department capability.',
        cardRankBadges: [
          '🌟 #1 Center of Excellence',
          '⭐ #2 Clinical Specialty Partner',
          '⭐ #3 Clinical Specialty Partner'
        ],
        cardRankBgs: ['#ede9fe', '#f3e8ff', '#f1f5f9'],
        cardRankColors: ['#6d28d9', '#7e22ce', '#334155'],
        cardRankBorders: ['#c4b5fd', '#d8b4fe', '#cbd5e1'],
        aiTitle: 'SehatSure AI Care Navigator • Clinical Department Guidance',
        aiTag: 'Clinical Specialty Engine'
      };
    }
    if (isNearestMode) {
      return {
        badgeIcon: <Navigation size={12} style={{ transform: 'rotate(45deg)' }} />,
        badgeText: 'Nearest In-Network Cashless',
        badgeBg: '#eff6ff',
        badgeColor: '#1d4ed8',
        badgeBorder: '#bfdbfe',
        title: selectedProcedure
          ? `Top 3 Nearest Cashless Hospitals for ${selectedProcedure}`
          : 'Top 3 Nearest In-Network Hospitals',
        subtitle: activeProximityOrigin
          ? `Pre-approved cashless partners under ${policy?.insurer || 'your policy'} closest to ${activeProximityOrigin.localityName} • Zero non-network penalties.`
          : `Pre-approved cashless partners under ${policy?.insurer || 'your policy'} • Ranked by closest proximity.`,
        cardRankBadges: [
          '🏆 1st Closest Cashless Partner',
          '🥈 2nd Nearest Cashless Partner',
          '🥉 3rd Nearest Cashless Partner'
        ],
        cardRankBgs: ['#dcfce7', '#e0f2fe', '#f1f5f9'],
        cardRankColors: ['#15803d', '#0369a1', '#334155'],
        cardRankBorders: ['#86efac', '#7dd3fc', '#cbd5e1'],
        aiTitle: 'SehatSure AI Care Navigator • Proximity & Emergency Access',
        aiTag: 'Real-Time Proximity Engine'
      };
    }
    // Default: coverageFit
    return {
      badgeIcon: <ShieldCheck size={13} />,
      badgeText: 'Best Policy Coverage Fit',
      badgeBg: '#ecfdf5',
      badgeColor: '#065f46',
      badgeBorder: '#a7f3d0',
      title: selectedProcedure
        ? `Best Coverage Fit Hospitals for ${selectedProcedure}`
        : 'Top In-Network Cashless Hospitals',
      subtitle: policy?.insurer
        ? `Hospitals with verified cashless claim admissibility under your ${policy.insurer} policy • Minimized out-of-pocket payment & zero room rent deductions.`
        : 'Hospitals maximizing cashless coverage and minimizing patient out-of-pocket expenses.',
      cardRankBadges: [
        '💎 #1 Highest Coverage Fit',
        '🛡️ #2 Optimal Policy Admissibility',
        '🛡️ #3 Optimal Policy Admissibility'
      ],
      cardRankBgs: ['#dcfce7', '#ecfdf5', '#f1f5f9'],
      cardRankColors: ['#15803d', '#047857', '#334155'],
      cardRankBorders: ['#86efac', '#a7f3d0', '#cbd5e1'],
      aiTitle: 'SehatSure AI Care Navigator • Financial Protection Guidance',
      aiTag: 'Real-Time Policy Intelligence'
    };
  }, [isSpecialtyMode, isNearestMode, isCoverageMode, selectedSpecialty, selectedProcedure, policy?.insurer, activeProximityOrigin]);

  return (
    <div className="discovery-page-content" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--section-gap)' }}>
      {/* Policy Executive Context Strip */}
      <section
        className="features"
        style={{
          padding: '24px clamp(20px, 3.5vw, 36px)',
          borderRadius: 'var(--radius-lg)',
          gap: '20px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
            <img
              src="/sehatsure-logo.png"
              alt="SehatSure"
              style={{ width: '56px', height: '56px', objectFit: 'contain', flexShrink: 0 }}
            />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span className="pill-label" style={{ fontSize: '11px', letterSpacing: '0.06em' }}>{t('discovery.activePolicyCoverage')}</span>
                {policy.insurer && (
                  <span className="pill-label" style={{ fontSize: '11px', fontWeight: 800, background: '#f1f5f9', color: '#0f172a', border: '1.5px solid #cbd5e1' }}>
                    {policy.insurer}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-text)', marginTop: '4px', letterSpacing: '-0.02em' }}>
                {policy.insurer ? policy.insurer.toUpperCase() : 'ACTIVE POLICY'} • <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>{policy.planName || 'Plan'}</span>
              </div>
            </div>
          </div>

          <div className="discovery-top-actions" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="pill-btn pill-btn-ghost"
              style={{ padding: '9px 18px', fontSize: '13px' }}
              onClick={onBackToPolicy}
            >
              {t('discovery.viewPolicyTerms')}
            </button>
            <button
              type="button"
              className="pill-btn pill-btn-primary"
              style={{ padding: '9px 20px', fontSize: '13px' }}
              onClick={onResetPolicy}
            >
              {t('discovery.changePolicy')}
            </button>
          </div>
        </div>

        {/* High-Visibility Policy Metrics (Sum Insured, Room Rent, Co-Pay, Exclusions) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
            width: '100%',
            paddingTop: '16px',
            borderTop: '1px solid var(--color-border)'
          }}
        >
          {/* Sum Insured */}
          <div
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {t('discovery.sumInsured')}
              </span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-text)', marginTop: '6px', letterSpacing: '-0.02em' }}>
              ₹{policy.sumInsured ? Number(policy.sumInsured).toLocaleString('en-IN') : t('common.unlimited')}
            </div>
          </div>

          {/* Room Rent */}
          <div
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {t('discovery.roomRentLimit')}
              </span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-text)', marginTop: '6px', letterSpacing: '-0.02em' }}>
              {policy.roomLimit ? (policy.roomLimit.type === 'amount' ? `₹${Number(policy.roomLimit.value).toLocaleString('en-IN')}/day` : t('discovery.percentOfSI', { percent: policy.roomLimit.value })) : t('discovery.noRoomLimit')}
            </div>
          </div>

          {/* Co-pay */}
          <div
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {t('discovery.baseCopay')}
              </span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-text)', marginTop: '6px', letterSpacing: '-0.02em' }}>
              {policy.copay || 0}%
            </div>
          </div>

          {/* Excluded Treatments (if any) */}
          {policy.exclusions && policy.exclusions.length > 0 && (
            <div
              style={{
                background: '#fef2f2',
                border: '1.5px solid #fecaca',
                borderRadius: 'var(--radius-md)',
                padding: '16px 20px',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Excluded Treatments
                </span>
                <span style={{ fontSize: '10px', background: '#fee2e2', color: '#991b1b', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                  Not Covered
                </span>
              </div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#991b1b', marginTop: '6px', textTransform: 'capitalize' }}>
                {policy.exclusions.join(', ')}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Filter Control Box */}
      <section className="features" style={{ padding: '32px clamp(20px, 4vw, 40px)', gap: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <span className="pill-label" style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em' }}>
              {t('discovery.filterBadge')}
            </span>
            <h2 className="section-heading" style={{ textAlign: 'left', fontSize: '24px', fontWeight: 700, marginTop: '6px' }}>
              {selectedCity.trim() ? t('discovery.findHospitalsWithCity', { city: selectedCity.trim() }) : t('discovery.findHospitalsGeneral')}
            </h2>
          </div>

          {(selectedCity || selectedSpecialty || selectedProcedure || searchQuery || typeFilter !== 'all') && (
            <button
              type="button"
              className="pill-btn pill-btn-ghost pill-btn-sm"
              onClick={handleClearFilters}
            >
              <RotateCcw size={13} style={{ marginRight: '6px' }} />
              {t('discovery.resetFilters')}
            </button>
          )}
        </div>

        {/* 4 Primary Inputs Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          {/* City */}
          <div className="field" ref={cityDropdownRef} style={{ position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap', gap: '4px' }}>
              <label className="field-label" style={{ fontSize: '12px', fontWeight: 600, margin: 0 }}>
                {t('discovery.city')}
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {/* 1-Click AIT Pune Campus shortcut */}
                {(!userLocation || userLocation.latitude !== 18.6183) && (
                  <button
                    type="button"
                    onClick={handleSetAITLocation}
                    style={{
                      background: '#ecfdf5',
                      border: '1px solid #a7f3d0',
                      borderRadius: 'var(--radius-pill)',
                      color: '#065f46',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '2px 8px',
                      transition: 'all 0.15s ease'
                    }}
                    title="Snap to AIT Pune Campus (Dighi Hills) ground-truth GPS (18.6183° N, 73.8768° E)"
                  >
                    <span>🎯 AIT Pune</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleToggleLocation}
                  disabled={isLocating}
                  style={{
                    background: userLocation ? '#f0fdf4' : '#f8fafc',
                    border: userLocation ? '1.5px solid #86efac' : '1px solid #cbd5e1',
                    borderRadius: 'var(--radius-pill)',
                    color: userLocation ? '#166534' : 'var(--color-primary, #0F766E)',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 8px',
                    transition: 'all 0.15s ease'
                  }}
                  title={userLocation ? 'Click to clear location' : 'Use GPS location to calculate hospital distance in km'}
                >
                  <Navigation size={11} style={{ transform: userLocation ? 'none' : 'rotate(45deg)' }} />
                  <span>
                    {isLocating
                      ? 'Detecting...'
                      : userLocation
                      ? `${userLocation.localityName || 'GPS Active'}`
                      : '📍 Use My Location'}
                  </span>
                  {userLocation && <X size={10} style={{ marginLeft: '2px' }} />}
                </button>
              </div>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="field-input"
                placeholder={t('discovery.cityInputPlaceholder')}
                value={cityInput}
                onChange={(e) => {
                  setCityInput(e.target.value);
                  setIsCityDropdownOpen(true);
                  setSortBy('coverageFit');
                }}
                onFocus={() => setIsCityDropdownOpen(true)}
                onKeyDown={handleCityKeyDown}
                style={{ paddingRight: cityInput ? '32px' : '14px', fontSize: '14px' }}
                autoComplete="off"
              />
              {cityInput && (
                <button
                  type="button"
                  onClick={handleClearCity}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--color-text-muted)'
                  }}
                  title={t('discovery.clearCity')}
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {/* Live Autocomplete Dropdown */}
            {isCityDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  left: 0,
                  right: 0,
                  zIndex: 200,
                  background: '#ffffff',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: '0 12px 28px rgba(0, 0, 0, 0.12), 0 4px 10px rgba(0, 0, 0, 0.06)',
                  maxHeight: '280px',
                  overflowY: 'auto'
                }}
              >
                <div
                  style={{
                    padding: '8px 14px',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--color-text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    borderBottom: '1px solid var(--color-border)',
                    background: 'var(--color-surface)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    position: 'sticky',
                    top: 0,
                    zIndex: 2
                  }}
                >
                  <span>{cityInput.trim() ? t('discovery.citiesMatching', { query: cityInput.trim() }) : t('discovery.topCities')}</span>
                  <span>{t('discovery.citiesFound', { count: matchingCities.length })}</span>
                </div>

                {matchingCities.length > 0 ? (
                  matchingCities.map((c) => {
                    const isSelected = selectedCity.toLowerCase() === c.name.toLowerCase();
                    return (
                      <div
                        key={c.name}
                        onClick={() => handleSelectCity(c.name)}
                        style={{
                          padding: '10px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          background: isSelected ? '#f0fdf4' : 'transparent',
                          borderBottom: '1px solid var(--color-border)',
                          transition: 'background 0.1s ease'
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.background = '#f9fafb';
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <MapPin size={14} style={{ color: isSelected ? '#16a34a' : 'var(--color-text-muted)', flexShrink: 0 }} />
                          <span style={{ fontSize: '14px', fontWeight: isSelected ? 700 : 500, color: 'var(--color-text)' }}>
                            <HighlightText text={c.name} highlight={cityInput} />
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: '11px',
                            color: isSelected ? '#166534' : 'var(--color-text-secondary)',
                            background: isSelected ? '#dcfce7' : 'var(--color-surface)',
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-pill)',
                            fontWeight: 600
                          }}
                        >
                          {t('discovery.hospitalsCount', { count: Number(c.count).toLocaleString('en-IN') })}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ padding: '16px 14px', textAlign: 'center', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                    {t('discovery.noCitiesMatching', { query: cityInput.trim() })}
                    <div style={{ marginTop: '8px' }}>
                      <button
                        type="button"
                        className="pill-btn pill-btn-ghost pill-btn-sm"
                        onClick={() => handleSelectCity(cityInput.trim())}
                      >
                        {t('discovery.searchCityAnyway', { query: cityInput.trim() })}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Specialty */}
          <div className="field">
            <label className="field-label" style={{ fontSize: '12px', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{t('discovery.specialtyDept')}</span>
              {selectedSpecialty && (
                <button
                  type="button"
                  onClick={() => setSelectedSpecialty('')}
                  style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '11px', cursor: 'pointer', fontWeight: 700 }}
                  title="Clear selected specialty"
                >
                  Clear ✕
                </button>
              )}
            </label>
            <select
              ref={specialtySelectRef}
              className="field-input"
              value={selectedSpecialty}
              onChange={(e) => setSelectedSpecialty(e.target.value)}
              style={{
                fontSize: '14px',
                borderColor: isSpecialtyMode && !selectedSpecialty ? '#7c3aed' : undefined,
                boxShadow: isSpecialtyMode && !selectedSpecialty ? '0 0 0 2px rgba(124, 58, 237, 0.25)' : undefined
              }}
            >
              <option value="">{t('discovery.allSpecialties')}</option>
              {specialties.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Procedure */}
          <div className="field">
            <label className="field-label" style={{ fontSize: '12px', fontWeight: 600 }}>
              {t('discovery.procedureSurgery')}
            </label>
            <select
              ref={procedureSelectRef}
              id="procedure-select"
              className="field-input"
              value={selectedProcedure}
              onChange={(e) => setSelectedProcedure(e.target.value)}
              disabled={!selectedSpecialty}
              style={{ fontSize: '14px' }}
            >
              <option value="">
                {selectedSpecialty ? t('discovery.allProceduresInDept') : t('discovery.selectSpecialtyFirst')}
              </option>
              {availableProcedures.map((p) => {
                const meta = procedureMetaMap[p];
                const label = meta?.description ? `${p} — ${meta.description}` : p;
                return (
                  <option key={p} value={p}>
                    {label}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Room Category */}
          <div className="field">
            <label className="field-label" style={{ fontSize: '12px', fontWeight: 600 }}>
              {t('discovery.roomCategory')}
            </label>
            <select
              className="field-input"
              value={selectedRoom}
              onChange={(e) => setSelectedRoom(e.target.value)}
              style={{ fontSize: '14px' }}
            >
              <option value="General Ward">{t('discovery.roomOptions.generalWard')}</option>
              <option value="Twin Sharing">{t('discovery.roomOptions.twinSharing')}</option>
              <option value="Single Private Room">{t('discovery.roomOptions.singlePrivate')}</option>
            </select>
          </div>
        </div>

        {/* Secondary: Search bar + quick filters */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingTop: '8px', borderTop: '1px solid var(--color-border)' }}>
          <div className="discovery-filter-toolbar" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Search Input */}
            <div className="discovery-search-wrapper" style={{ flex: 1, minWidth: '260px', position: 'relative' }}>
              <input
                type="text"
                className="field-input"
                placeholder={t('discovery.searchHospitalPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '40px', fontSize: '14px' }}
              />
              <Search
                size={16}
                style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {/* Quick Type Filter Pills: All, Private, Govt */}
            <div className="role-tabs" style={{ width: 'auto', marginBottom: 0 }}>
              {[
                { key: 'all', label: t('discovery.typeFilter.all') },
                { key: 'private', label: t('discovery.typeFilter.private') },
                { key: 'government', label: t('discovery.typeFilter.govt') }
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`role-tab ${typeFilter === tab.key ? 'role-tab-active' : ''}`}
                  onClick={() => setTypeFilter(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Network Mode Toggle Pill */}
            <button
              type="button"
              className={`pill-btn ${networkOnly ? 'pill-btn-primary' : 'pill-btn-ghost'}`}
              style={{
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                borderRadius: 'var(--radius-pill)',
                border: networkOnly ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                cursor: policy?.insurer ? 'default' : 'pointer'
              }}
              onClick={() => {
                if (!policy?.insurer) {
                  setNetworkOnly(!networkOnly);
                }
              }}
              title={
                policy?.insurer
                  ? `Showing exclusively verified ${policy.insurer} network hospitals`
                  : (networkOnly ? t('discovery.networkMatchToggleTitleOn') : t('discovery.networkMatchToggleTitleOff'))
              }
            >
              <ShieldCheck size={14} style={{ color: networkOnly ? '#fff' : '#16a34a' }} />
              <span>
                {policy?.insurer
                  ? `${policy.insurer} Network Only`
                  : (networkOnly ? t('discovery.networkMatchToggleOn') : t('discovery.networkMatchToggle'))}
              </span>
            </button>

            {/* SehatSure Discovery Mode & Ranking Tabs (Always visible & prominent) */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                background: '#f1f5f9',
                borderRadius: 'var(--radius-pill)',
                padding: '3px',
                border: '1.5px solid #cbd5e1',
                gap: '2px',
                flexWrap: 'wrap'
              }}
            >
              {/* Coverage Fit */}
              <button
                type="button"
                className={`pill-btn ${sortBy === 'coverageFit' ? 'pill-btn-primary' : 'pill-btn-ghost'}`}
                style={{
                  fontSize: '12px',
                  padding: '6px 14px',
                  fontWeight: sortBy === 'coverageFit' ? 800 : 600,
                  borderRadius: 'var(--radius-pill)',
                  border: 'none',
                  background: sortBy === 'coverageFit' ? '#0f172a' : 'transparent',
                  color: sortBy === 'coverageFit' ? '#ffffff' : '#475569',
                  boxShadow: sortBy === 'coverageFit' ? '0 2px 6px rgba(0,0,0,0.15)' : 'none',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => setSortBy('coverageFit')}
                title="Sort by maximum insurance coverage & lowest out-of-pocket payment"
              >
                <ShieldCheck size={14} style={{ color: sortBy === 'coverageFit' ? '#4ade80' : '#16a34a' }} />
                <span>Best Coverage Fit</span>
              </button>

              {/* Nearest First */}
              <button
                type="button"
                className={`pill-btn ${sortBy === 'nearestFirst' ? 'pill-btn-primary' : 'pill-btn-ghost'}`}
                style={{
                  fontSize: '12px',
                  padding: '6px 14px',
                  fontWeight: sortBy === 'nearestFirst' ? 800 : 600,
                  borderRadius: 'var(--radius-pill)',
                  border: 'none',
                  background: sortBy === 'nearestFirst' ? '#0284c7' : 'transparent',
                  color: sortBy === 'nearestFirst' ? '#ffffff' : '#475569',
                  boxShadow: sortBy === 'nearestFirst' ? '0 2px 6px rgba(2, 132, 199, 0.25)' : 'none',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => {
                  if (!userLocation && !selectedCity) {
                    handleToggleLocation();
                  }
                  setSortBy('nearestFirst');
                }}
                title="Sort by nearest distance to your location"
              >
                <Navigation size={13} style={{ transform: 'rotate(45deg)', color: sortBy === 'nearestFirst' ? '#ffffff' : '#0284c7' }} />
                <span>Nearest Cashless First</span>
              </button>

              {/* SehatSure Specialty Fit */}
              <button
                type="button"
                className={`pill-btn ${sortBy === 'specialtyFit' ? 'pill-btn-primary' : 'pill-btn-ghost'}`}
                style={{
                  fontSize: '12px',
                  padding: '6px 14px',
                  fontWeight: sortBy === 'specialtyFit' ? 800 : 600,
                  borderRadius: 'var(--radius-pill)',
                  border: 'none',
                  background: sortBy === 'specialtyFit' ? '#7c3aed' : 'transparent',
                  color: sortBy === 'specialtyFit' ? '#ffffff' : '#475569',
                  boxShadow: sortBy === 'specialtyFit' ? '0 2px 6px rgba(124, 58, 237, 0.25)' : 'none',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => {
                  setSortBy('specialtyFit');
                  if (!selectedSpecialty) {
                    handleFocusSpecialtySelect();
                  }
                }}
                title="Sort by SehatSure Specialty Match, clinical excellence, and department capabilities"
              >
                <Stethoscope size={14} style={{ color: sortBy === 'specialtyFit' ? '#ffffff' : '#7c3aed' }} />
                <span>SehatSure Specialty Fit</span>
                {selectedSpecialty && (
                  <span
                    style={{
                      fontSize: '10px',
                      padding: '1px 6px',
                      borderRadius: '8px',
                      background: sortBy === 'specialtyFit' ? 'rgba(255,255,255,0.25)' : '#ede9fe',
                      color: sortBy === 'specialtyFit' ? '#ffffff' : '#6d28d9',
                      fontWeight: 700
                    }}
                  >
                    {selectedSpecialty}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Quick Locality chips for selected city */}
          {selectedCity.trim() && cityLocalities.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{t('discovery.localitiesLabel')}</span>
              {cityLocalities.slice(0, 12).map((loc) => {
                const isSelected = searchQuery.toLowerCase() === loc.toLowerCase();
                return (
                  <button
                    key={loc}
                    type="button"
                    className={`pill-label ${isSelected ? 'pill-btn-primary' : ''}`}
                    style={{ cursor: 'pointer', fontSize: '11px', padding: '4px 12px' }}
                    onClick={() => {
                      const nextQ = isSelected ? '' : loc;
                      setSearchQuery(nextQ);
                      if (nextQ) {
                        setSortBy('nearestFirst');
                      }
                    }}
                  >
                    {loc}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Results Header Strip */}
      {selectedCity.trim() && !loading && hospitals.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Active Filter & Mode Badges Strip */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexWrap: 'wrap',
              background: '#ffffff',
              padding: '10px 18px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
            }}
          >
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Current View & Filters:
            </span>

            {/* City Tag */}
            <span className="pill-label" style={{ fontSize: '11.5px', background: '#f8fafc', color: '#0f172a', border: '1px solid #cbd5e1', fontWeight: 700 }}>
              📍 City: {selectedCity}
            </span>

            {/* Mode Tag */}
            <span
              className="pill-label"
              style={{
                fontSize: '11.5px',
                background: isSpecialtyMode ? '#f5f3ff' : isNearestMode ? '#eff6ff' : '#ecfdf5',
                color: isSpecialtyMode ? '#6d28d9' : isNearestMode ? '#1e40af' : '#15803d',
                border: `1px solid ${isSpecialtyMode ? '#ddd6fe' : isNearestMode ? '#bfdbfe' : '#a7f3d0'}`,
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              {modeConfig.badgeIcon}
              <span>Mode: {modeConfig.badgeText}</span>
            </span>

            {/* Specialty Tag with Remove */}
            {selectedSpecialty && (
              <span
                className="pill-label"
                style={{
                  fontSize: '11.5px',
                  background: '#f5f3ff',
                  color: '#6d28d9',
                  border: '1.5px solid #c4b5fd',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Stethoscope size={12} />
                <span>Dept: {selectedSpecialty}</span>
                <button
                  type="button"
                  onClick={() => setSelectedSpecialty('')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7c3aed', padding: 0, fontWeight: 800, fontSize: '12px' }}
                  title="Remove department filter"
                >
                  ✕
                </button>
              </span>
            )}

            {/* Procedure Tag with Remove */}
            {selectedProcedure && (
              <span
                className="pill-label"
                style={{
                  fontSize: '11.5px',
                  background: '#f0fdf4',
                  color: '#15803d',
                  border: '1.5px solid #86efac',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>Procedure: {selectedProcedure}</span>
                <button
                  type="button"
                  onClick={() => setSelectedProcedure('')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#16a34a', padding: 0, fontWeight: 800, fontSize: '12px' }}
                  title="Remove procedure filter"
                >
                  ✕
                </button>
              </span>
            )}

            {/* Room Tag */}
            {selectedRoom && selectedRoom !== 'General Ward' && (
              <span className="pill-label" style={{ fontSize: '11.5px', background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', fontWeight: 600 }}>
                🛏️ {selectedRoom}
              </span>
            )}

            {/* Reset Action */}
            {(selectedSpecialty || selectedProcedure || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedSpecialty('');
                  setSelectedProcedure('');
                  setSearchQuery('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#dc2626',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  marginLeft: 'auto',
                  textDecoration: 'underline'
                }}
              >
                Clear Filters
              </button>
            )}
          </div>

          <div className="strip" style={{ padding: '16px 24px', borderRadius: 'var(--radius-md)', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span className="strip-mark strip-mark-circle" />
              <span style={{ fontSize: '14px', fontWeight: 600 }}>
                {t('discovery.showingHospitals', { shown: filteredHospitals.length, total: totalCount, city: selectedCity.trim() })}
              </span>
              <span
                style={{
                  fontSize: '12px',
                  padding: '3px 10px',
                  borderRadius: 'var(--radius-pill)',
                  background: networkFacilityCount > 0 ? '#dcfce7' : '#fee2e2',
                  color: networkFacilityCount > 0 ? '#15803d' : '#b91c1c',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <ShieldCheck size={13} />
                {networkFacilityCount === 1 ? t('discovery.networkMatchCount', { count: networkFacilityCount }) : t('discovery.networkMatchesCount', { count: networkFacilityCount })}
              </span>
              {selectedSpecialty && sortBy === 'specialtyFit' ? (
                <span
                  className="pill-label"
                  style={{
                    fontSize: '11px',
                    padding: '3px 10px',
                    background: '#f0fdf4',
                    color: '#166534',
                    borderColor: '#bbf7d0',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  {filteredHospitals.length === 1 ? t('discovery.specialtySpotlightFacility', { count: filteredHospitals.length }) : t('discovery.specialtySpotlightFacilities', { count: filteredHospitals.length })}
                </span>
              ) : selectedSpecialty ? (
                <span className="pill-label" style={{ fontSize: '11px', padding: '3px 8px' }}>
                  {t('discovery.specialtyMatchesCount', { count: specialtyMatchedCount })}
                </span>
              ) : null}
              {selectedProcedure && (
                <span className="pill-label" style={{ fontSize: '11px', padding: '3px 8px' }}>
                  {t('discovery.procedureMatchesCount', { count: procedureMatchedCount })}
                </span>
              )}
            </div>

            {cityAverageCost > 0 && (
              <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginLeft: 'auto' }}>
                {t('discovery.benchmarkAverage', { city: selectedCity.trim(), avg: formatINR(cityAverageCost) })}
              </div>
            )}
          </div>

          {/* Mode C Notice: When browsing all hospitals but 0 verified network matches exist */}
          {!networkOnly && networkFacilityCount === 0 && (
            <div
              className="form-alert"
              style={{
                background: '#fffbeb',
                border: '1px solid #fde68a',
                color: '#92400e',
                borderRadius: 'var(--radius-md)',
                padding: '12px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                fontSize: '13px'
              }}
            >
              <AlertTriangle size={18} style={{ flexShrink: 0, color: '#d97706' }} />
              <div>
                <strong>{t('discovery.noVerifiedNetworkAlert', { insurer: policy.insurer || 'your insurer', city: selectedCity.trim() })}</strong>
                <div style={{ marginTop: '2px', opacity: 0.9 }}>
                  {t('discovery.noVerifiedNetworkSub')}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-text-secondary)' }}>
          <div className="hero-emblem" style={{ margin: '0 auto 16px' }}>
            <div className="hero-emblem-ring" style={{ animation: 'spin 3s linear infinite' }} />
            <div className="hero-emblem-core" />
          </div>
          <div style={{ fontSize: '16px', fontWeight: 600 }}>{t('discovery.calculatingCosts')}</div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="form-alert form-alert-error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Specialty Exclusion Alert */}
      {isCurrentSpecialtyExcluded && (
        <div
          style={{
            background: '#fef2f2',
            border: '1.5px solid #fca5a5',
            borderRadius: 'var(--radius-md)',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            color: '#991b1b',
            boxShadow: '0 2px 6px rgba(185, 28, 28, 0.08)'
          }}
        >
          <AlertOctagon size={24} style={{ color: '#dc2626', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: '15px', fontWeight: 800 }}>
              Specialty Exclusion: {selectedSpecialty} Treatments Are Not Covered by Your Policy
            </div>
            <div style={{ fontSize: '13px', marginTop: '4px', lineHeight: 1.5 }}>
              Your {policy.insurer || 'uploaded'} policy explicitly excludes claims for {selectedSpecialty}. Hospital bills for {selectedSpecialty} treatments are not admissible by your insurer and require 100% patient out-of-pocket payment.
            </div>
          </div>
        </div>
      )}

      {/* FIN-01 Scenario Recalculator: Demonstrate how estimates change when additional information is supplied */}
      {!loading && displayedHospitals.length > 0 && (
        <ScenarioRecalculator
          policy={policy}
          selectedHospital={displayedHospitals[0]?.hospital}
          selectedProcedure={selectedProcedure}
          selectedCity={selectedCity}
        />
      )}

      {/* Dynamic Multi-Mode Spotlight Panel (Adapts to Coverage, Nearest, Specialty) */}
      {!loading && displayedHospitals.length > 0 && (
        <section
          className="nearest-spotlight-panel"
          style={{
            background: isSpecialtyMode
              ? 'linear-gradient(145deg, #faf5ff 0%, #ffffff 60%, #f5f3ff 100%)'
              : isNearestMode
              ? 'linear-gradient(145deg, #f0f9ff 0%, #ffffff 60%, #f8fafc 100%)'
              : 'linear-gradient(145deg, #f0fdf4 0%, #ffffff 60%, #f8fafc 100%)',
            border: isSpecialtyMode ? '1.5px solid #ddd6fe' : isNearestMode ? '1.5px solid #bae6fd' : '1.5px solid #bbf7d0',
            borderRadius: 'var(--radius-lg)',
            padding: 'clamp(18px, 2.5vw, 28px)',
            boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            transition: 'all 0.3s ease'
          }}
        >
          {/* Header Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span
                  style={{
                    background: modeConfig.badgeBg,
                    color: modeConfig.badgeColor,
                    border: `1px solid ${modeConfig.badgeBorder}`,
                    fontSize: '11px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    padding: '3px 10px',
                    borderRadius: 'var(--radius-pill)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  {modeConfig.badgeIcon}
                  <span>{modeConfig.badgeText}</span>
                </span>
                {policy?.insurer && (
                  <span
                    style={{
                      background: '#f1f5f9',
                      color: '#0f172a',
                      border: '1px solid #cbd5e1',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '3px 10px',
                      borderRadius: 'var(--radius-pill)'
                    }}
                  >
                    Covered by {policy.insurer}
                  </span>
                )}
                {isNearestMode && activeProximityOrigin && (
                  <span
                    style={{
                      background: '#eff6ff',
                      color: '#1e40af',
                      border: '1px solid #bfdbfe',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '3px 10px',
                      borderRadius: 'var(--radius-pill)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Compass size={12} />
                    <span>Nearest to: {activeProximityOrigin.localityName}</span>
                  </span>
                )}
              </div>

              <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', marginTop: '8px', marginBottom: '4px', letterSpacing: '-0.02em' }}>
                {modeConfig.title}
              </h2>
              <p style={{ fontSize: '13px', color: '#64748b', margin: 0, lineHeight: 1.45 }}>
                {modeConfig.subtitle}
              </p>
            </div>

            {/* Mode switch quick actions */}
            {isNearestMode && !userLocation && (
              <button
                type="button"
                className="pill-btn pill-btn-primary pill-btn-sm"
                onClick={handleToggleLocation}
                disabled={isLocating}
                style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 700 }}
              >
                <LocateFixed size={14} />
                <span>{isLocating ? 'Detecting Location...' : '📍 Detect Nearest to Me'}</span>
              </button>
            )}
          </div>

          {/* Specialty Mode Prompt when no specialty is picked yet */}
          {isSpecialtyMode && !selectedSpecialty && (
            <div
              style={{
                background: '#f5f3ff',
                border: '1.5px dashed #c4b5fd',
                borderRadius: '8px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                flexWrap: 'wrap'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#6d28d9', fontWeight: 600 }}>
                <Stethoscope size={16} />
                <span>Showing top multidisciplinary centers. Quick-select your department to hone in on procedure-specific surgical teams:</span>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {specialties.slice(0, 6).map((sp) => (
                  <button
                    key={sp}
                    type="button"
                    onClick={() => setSelectedSpecialty(sp)}
                    className="pill-label"
                    style={{ cursor: 'pointer', fontSize: '11px', padding: '3px 10px', background: '#ede9fe', color: '#6d28d9', border: '1px solid #c4b5fd', fontWeight: 700 }}
                  >
                    {sp}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* SehatSure AI Care Guidance Note (Strictly NO 'Gemini' text) */}
          <div
            style={{
              background: isSpecialtyMode
                ? 'linear-gradient(135deg, #f5f3ff 0%, #ffffff 50%, #faf5ff 100%)'
                : 'linear-gradient(135deg, #f0fdf4 0%, #f8fafc 60%, #eff6ff 100%)',
              border: isSpecialtyMode ? '1.5px solid #ddd6fe' : '1.5px solid #bbf7d0',
              borderRadius: 'var(--radius-md)',
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: isSpecialtyMode
                      ? 'linear-gradient(135deg, #7c3aed, #a855f7)'
                      : 'linear-gradient(135deg, #0284c7, #10b981)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    flexShrink: 0
                  }}
                >
                  <Sparkles size={16} />
                </div>
                <span style={{ fontSize: '13.5px', fontWeight: 800, color: '#0f172a' }}>
                  {modeConfig.aiTitle}
                </span>
              </div>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                {modeConfig.aiTag}
              </span>
            </div>

            {isLoadingGuidance ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', color: '#475569', fontSize: '13px' }}>
                <span className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
                <span>Analyzing policy cashless admission criteria and clinical readiness for {selectedProcedure || selectedSpecialty || 'your treatment'}...</span>
              </div>
            ) : nearestGuidance ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', lineHeight: 1.55 }}>
                <div style={{ color: '#1e293b', fontWeight: 600 }}>
                  💡 {nearestGuidance.summary}
                </div>
                {nearestGuidance.recommendation && (
                  <div
                    style={{
                      color: isSpecialtyMode ? '#5b21b6' : '#047857',
                      background: isSpecialtyMode ? '#f5f3ff' : '#ecfdf5',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: isSpecialtyMode ? '1px solid #ddd6fe' : '1px solid #a7f3d0'
                    }}
                  >
                    <strong>Next Steps:</strong> {nearestGuidance.recommendation}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>
                All 3 facilities below are verified within your policy's approved cashless network for {selectedProcedure || selectedSpecialty || 'this procedure'}. Present your e-Card at their TPA insurance desk for seamless cashless admission with zero non-network co-pay deductions.
              </div>
            )}
          </div>

          {/* Top 3 Spotlight Cards */}
          {top3SpotlightHospitals.length > 0 ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
                gap: '16px'
              }}
            >
              {top3SpotlightHospitals.map((item, index) => {
                const h = item.hospital;
                const score = item.score || {};
                const isFirst = index === 0;

                const ci = item.costIntelligence;
                const hasCI = Boolean(ci && ci.available && (item.estimate?.available !== false));
                const isUnselected =
                  Boolean(ci?.isProcedureUnselected) ||
                  !selectedProcedure ||
                  selectedProcedure.trim() === '' ||
                  selectedProcedure.toLowerCase() === 'all' ||
                  selectedProcedure.toLowerCase().includes('all procedure');
                const isCostReliable = hasCI && !isUnselected;

                const patientOOP = Number(score.patientPayable ?? 0);
                const isZeroOOP = isCostReliable && patientOOP === 0;

                // Dynamic badge: Only claim "Zero Out-of-Pocket" if cost is reliable and patient payable is actually 0
                let badgeLabel = modeConfig.cardRankBadges[index] || `Top Facility #${index + 1}`;
                if (isCoverageMode) {
                  if (index === 0) {
                    badgeLabel = isZeroOOP
                      ? '💎 #1 Highest Coverage (Zero Out-of-Pocket)'
                      : '💎 #1 Highest Coverage Fit';
                  } else if (index === 1) {
                    badgeLabel = isZeroOOP
                      ? '🛡️ #2 Optimal Coverage (Zero Out-of-Pocket)'
                      : '🛡️ #2 Optimal Policy Admissibility';
                  } else {
                    badgeLabel = isZeroOOP
                      ? '🛡️ #3 Optimal Coverage (Zero Out-of-Pocket)'
                      : '🛡️ #3 Optimal Policy Admissibility';
                  }
                }
                const badgeBg = modeConfig.cardRankBgs[index] || '#f1f5f9';
                const badgeColor = modeConfig.cardRankColors[index] || '#334155';
                const badgeBorder = modeConfig.cardRankBorders[index] || '#cbd5e1';

                return (
                  <div
                    key={h.hospital_name + index}
                    style={{
                      background: '#ffffff',
                      border: isFirst
                        ? isSpecialtyMode
                          ? '2px solid #7c3aed'
                          : '2px solid #22c55e'
                        : '1.5px solid #e2e8f0',
                      borderRadius: 'var(--radius-md)',
                      padding: '16px 18px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '14px',
                      boxShadow: isFirst
                        ? isSpecialtyMode
                          ? '0 6px 16px -2px rgba(124, 58, 237, 0.15)'
                          : '0 6px 16px -2px rgba(34, 197, 94, 0.12)'
                        : '0 2px 8px rgba(0,0,0,0.03)',
                      position: 'relative'
                    }}
                  >
                    <div>
                      {/* Rank Badge */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 800,
                            padding: '3px 10px',
                            borderRadius: 'var(--radius-pill)',
                            background: badgeBg,
                            color: badgeColor,
                            border: `1px solid ${badgeBorder}`,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          {badgeLabel}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '12px', fontWeight: 700, color: '#f59e0b' }}>
                          <Star size={13} fill="#f59e0b" color="#f59e0b" />
                          <span>{h.rating ? h.rating.toFixed(1) : '4.3'}</span>
                        </div>
                      </div>

                      {/* Hospital Name */}
                      <h3
                        style={{
                          fontSize: '16px',
                          fontWeight: 800,
                          color: '#0f172a',
                          margin: 0,
                          lineHeight: 1.35
                        }}
                      >
                        {h.hospital_name}
                      </h3>

                      {/* Locality Tag (no raw km numbers) */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '6px', fontSize: '12.5px', color: '#475569' }}>
                        <MapPin size={13} style={{ color: '#0284c7', flexShrink: 0 }} />
                        <span style={{ fontWeight: 600 }}>{item.localityLabel || h.address || 'Nearby Area'}</span>
                      </div>

                      {/* Specialty Match Tag (for specialty mode) */}
                      {isSpecialtyMode && (
                        <div style={{ marginTop: '8px' }}>
                          <span
                            className="asset-chip"
                            style={{
                              fontSize: '11px',
                              padding: '3px 8px',
                              fontWeight: 700,
                              color: '#6d28d9',
                              background: '#f5f3ff',
                              border: '1px solid #ddd6fe',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <Stethoscope size={11} />
                            <span>{item.specialtyNameMatch?.matched ? 'Direct Department Match' : (selectedSpecialty || 'Specialty Center')}</span>
                          </span>
                        </div>
                      )}

                      {/* Cashless Coverage & Procedure Tag */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            color: '#15803d',
                            background: '#f0fdf4',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            border: '1px solid #bbf7d0',
                            width: 'fit-content'
                          }}
                        >
                          <ShieldCheck size={13} />
                          <span>
                            {isZeroOOP
                              ? `100% Cashless Covered (${policy?.insurer || 'Network Verified'})`
                              : `Cashless Network Partner (${policy?.insurer || 'Network Verified'})`}
                          </span>
                        </div>
                        {selectedProcedure && (
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              fontSize: '11.5px',
                              fontWeight: 600,
                              color: '#334155',
                              background: '#f8fafc',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              border: '1px solid #e2e8f0',
                              width: 'fit-content'
                            }}
                          >
                            <Stethoscope size={12} />
                            <span>{selectedProcedure}</span>
                          </div>
                        )}
                      </div>

                      {/* Financial Est */}
                      {isCostReliable ? (
                        <div
                          style={{
                            marginTop: '12px',
                            padding: '10px 12px',
                            background: '#f8fafc',
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Expected Patient Out-of-Pocket</div>
                            <div style={{ fontSize: '16px', fontWeight: 800, color: (score.patientPayable || 0) > 0 ? '#b91c1c' : '#16a34a' }}>
                              {formatINR(score.patientPayable || 0)}
                            </div>
                          </div>
                          {isZeroOOP && (
                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a', background: '#dcfce7', padding: '2px 8px', borderRadius: '4px' }}>
                              Full Cashless
                            </span>
                          )}
                        </div>
                      ) : Boolean(ci?.mlCostAnalysis && ci.mlCostAnalysis.status === 'available' && ci.mlCostAnalysis.mlEstimate) ? (
                        <div
                          style={{
                            marginTop: '12px',
                            padding: '10px 12px',
                            background: '#f8fafc',
                            borderRadius: '8px',
                            border: '1.5px solid #0f766e',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '10.5px', color: '#0f766e', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Cpu size={12} />
                              <span>AI STATISTICAL ESTIMATE</span>
                            </div>
                            <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f766e', marginTop: '2px' }}>
                              ~{ci.mlCostAnalysis.displayEstimate}
                            </div>
                            <div style={{ fontSize: '10px', color: '#64748b' }}>
                              Model reference ({ci.mlCostAnalysis.matchedTier || 'Metro 1'})
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedWhyNoEstimateModal({
                                hospital: h,
                                specialty: selectedSpecialty,
                                procedure: selectedProcedure || ci?.procedure || 'This procedure',
                                costIntelligence: ci
                              });
                            }}
                            style={{
                              background: '#ffffff',
                              border: '1px solid #0f766e',
                              borderRadius: '6px',
                              padding: '5px 10px',
                              fontSize: '11px',
                              fontWeight: 700,
                              color: '#0f766e',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            Details →
                          </button>
                        </div>
                      ) : (
                        <div
                          style={{
                            marginTop: '12px',
                            padding: '10px 12px',
                            background: '#fffbeb',
                            borderRadius: '8px',
                            border: '1.5px solid #fde68a',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '11px', color: '#9a3412', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <AlertTriangle size={12} style={{ color: '#ea580c', flexShrink: 0 }} />
                              <span>COST ESTIMATE UNAVAILABLE</span>
                            </div>
                            <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#475569', marginTop: '2px' }}>
                              {isUnselected ? 'Procedure Selection Required' : 'Estimate Unavailable'}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (isUnselected) {
                                handleFocusProcedureSelect();
                              } else {
                                setSelectedWhyNoEstimateModal({
                                  hospital: h,
                                  specialty: selectedSpecialty,
                                  procedure: selectedProcedure || ci?.procedure || 'This procedure',
                                  costIntelligence: ci
                                });
                              }
                            }}
                            style={{
                              background: '#ffffff',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              padding: '4px 8px',
                              fontSize: '11px',
                              fontWeight: 700,
                              color: '#0284c7',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {isUnselected ? 'Select' : 'Why?'}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                      {isCostReliable ? (
                        <button
                          type="button"
                          className="pill-btn pill-btn-primary pill-btn-sm"
                          style={{ flex: 1, padding: '7px 10px', fontSize: '12px', fontWeight: 700 }}
                          onClick={() => openBreakdownModal(item)}
                        >
                          Bill Breakdown
                        </button>
                      ) : isUnselected ? (
                        <button
                          type="button"
                          className="pill-btn pill-btn-primary pill-btn-sm"
                          style={{
                            flex: 1,
                            padding: '7px 10px',
                            fontSize: '12px',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '5px'
                          }}
                          onClick={handleFocusProcedureSelect}
                        >
                          <Stethoscope size={12} />
                          <span>Select Procedure</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="pill-btn pill-btn-secondary pill-btn-sm"
                          style={{
                            flex: 1,
                            padding: '7px 10px',
                            fontSize: '12px',
                            fontWeight: 700,
                            background: '#fffbeb',
                            color: '#92400e',
                            border: '1.5px solid #fde68a',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px'
                          }}
                          onClick={() => setSelectedWhyNoEstimateModal({
                            hospital: h,
                            specialty: selectedSpecialty,
                            procedure: selectedProcedure || ci?.procedure || 'This procedure'
                          })}
                        >
                          <HelpCircle size={13} style={{ color: '#d97706' }} />
                          <span>Why no estimate?</span>
                        </button>
                      )}
                      <a
                        href={getGoogleMapsUrl({
                          hospital_name: h.hospital_name,
                          address: h.address,
                          city: h.city || selectedCity
                        })}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="pill-btn pill-btn-ghost pill-btn-sm"
                        style={{
                          padding: '7px 10px',
                          fontSize: '12px',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          textDecoration: 'none'
                        }}
                        title="Open turn-by-turn navigation in Google Maps"
                      >
                        <Navigation size={12} />
                        <span>Directions</span>
                        <ExternalLink size={10} />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
              No in-network hospitals found for the current filter selection. Try clearing specific filters to see matching facilities.
            </div>
          )}
        </section>
      )}

      {/* Hospital Cards Grid */}
      {!loading && displayedHospitals.length > 0 && (
        <div className="hospitals-grid">
          {displayedHospitals.map((item, idx) => {
            const h = item.hospital;
            const est = item.estimate;
            const score = item.score;
            const hasExcess = score.excessOverSI > 0;
            const netInfo = item.networkInfo || {
              networkStatus: 'unknown',
              matchedInsurer: null,
              matchMethod: 'insufficient_data',
              matchEvidence: null
            };
            const networkStatus = netInfo.networkStatus || 'unknown';
            const isVerified = networkStatus === 'verified';
            const isNoMatch = networkStatus === 'no_match';
            const isUnverified = networkStatus === 'unverified';
            const isSaved = isHospitalSaved(h.hospital_name, h.address);

            return (
              <div key={h.hospital_name + h.address} className="feature-card" style={{ gap: '16px', minWidth: 0, overflow: 'hidden', padding: '22px 20px', border: '1.5px solid #cbd5e1', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
                {/* Header Row: #idx+1, Type, Metro/Tier, Rating, SehatSure Score, Spotlight, [rightest] Save Option */}
                {/* Header Row: Left Badges | Middle SehatSure Score | Right Save Option */}
                <div className="hospital-card-header">
                  {/* Left: Metadata Badges (#idx+1, Type, Metro/Tier, Rating) */}
                  <div className="hospital-card-header-left">
                    <span className="pill-label" style={{ fontSize: '11px', padding: '3px 8px', fontWeight: 800, background: '#f1f5f9', color: '#0f172a', border: '1.5px solid #cbd5e1', whiteSpace: 'nowrap' }}>
                      #{idx + 1}
                    </span>
                    <span className="pill-label" style={{ fontSize: '11px', padding: '3px 8px', fontWeight: 700, background: '#f8fafc', color: '#0f172a', border: '1.5px solid #cbd5e1', whiteSpace: 'nowrap' }}>
                      {h.hospital_type || 'Private'}
                    </span>
                    <span className="pill-label" style={{ fontSize: '11px', padding: '3px 8px', fontWeight: 700, background: '#f8fafc', color: '#0f172a', border: '1.5px solid #cbd5e1', whiteSpace: 'nowrap' }}>
                      {h.tier || 'Metro 1'}
                    </span>
                    {h.rating > 0 && (
                      <span className="pill-label" style={{ fontSize: '11px', padding: '3px 7px', fontWeight: 800, background: '#fffbeb', color: '#92400e', border: '1.5px solid #fde68a', whiteSpace: 'nowrap' }}>
                        ★ {Number(h.rating).toFixed(1)}
                      </span>
                    )}
                  </div>

                  {/* Middle: SehatSure Score (centered in this line) */}
                  <div className="hospital-card-header-middle">
                    {score && (score.granularScore !== undefined || score.finalScore !== undefined) && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedScoreForModal({
                            hospital: h,
                            score,
                            estimate: est,
                            networkInfo: netInfo
                          });
                        }}
                        className="pill-label pill-label-interactive"
                        style={{
                          fontSize: '11.5px',
                          padding: '3.5px 11px',
                          fontWeight: 800,
                          background: 'var(--color-teal-light, #F0FDFA)',
                          color: 'var(--color-primary, #0F766E)',
                          border: '1.5px solid var(--color-teal-border, #CCFBF1)',
                          borderRadius: 'var(--radius-pill)',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          whiteSpace: 'nowrap',
                          transition: 'all 0.15s ease',
                          boxShadow: '0 1px 3px rgba(15,118,110,0.08)'
                        }}
                        title={t('discovery.hospitalCard.fitScoreExplanation')}
                      >
                        <span>
                          {t('discovery.hospitalCard.fitScoreLabel', {
                            score: Number(score.granularScore ?? score.finalScore).toFixed(1)
                          }, `SehatSure Score : ${Number(score.granularScore ?? score.finalScore).toFixed(1)}`)}
                        </span>
                      </button>
                    )}
                  </div>

                  {/* Right: Save Option */}
                  <div className="hospital-card-header-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!user && onRequireAuth) {
                          onRequireAuth();
                        }
                        toggleSaveHospital(h, est, score);
                      }}
                      style={{
                        background: isSaved ? 'var(--color-teal-light, #F0FDFA)' : '#ffffff',
                        border: isSaved ? '1.5px solid var(--color-secondary-teal, #0D9488)' : '1.5px solid var(--color-border, #CBD5E1)',
                        borderRadius: 'var(--radius-pill)',
                        padding: '4px 12px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontSize: '12px',
                        fontWeight: 700,
                        color: isSaved ? 'var(--color-primary, #0F766E)' : 'var(--color-text, #0f172a)',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.15s ease',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
                      }}
                      title={isSaved ? 'Hospital bookmarked in profile. Click to remove.' : 'Save this hospital to your profile'}
                    >
                      <Bookmark size={14} fill={isSaved ? 'var(--color-primary, #0F766E)' : 'none'} color={isSaved ? 'var(--color-primary, #0F766E)' : 'currentColor'} />
                      <span>{isSaved ? 'Saved' : 'Save'}</span>
                    </button>
                  </div>
                </div>

                {/* Hospital Name & Address */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h3 className="feature-title" style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', lineHeight: 1.3, margin: 0, overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                      <HighlightText text={h.hospital_name} highlight={searchQuery} />
                    </h3>
                    {item.specialtyNameMatch?.matched && item.specialtyNameMatch.score > 0 && selectedSpecialty && (
                      <span
                        className="pill-label"
                        style={{
                          fontSize: '11px',
                          padding: '2.5px 8px',
                          fontWeight: 700,
                          background: '#f0fdf4',
                          color: '#166534',
                          border: '1.5px solid #bbf7d0',
                          cursor: 'help'
                        }}
                        title={item.specialtyNameMatch.explanation || t('discovery.hospitalCard.spotlightTooltip', { specialty: selectedSpecialty })}
                      >
                        🟢 {t('discovery.hospitalCard.spotlight')}
                      </span>
                    )}
                    {isSpecialtyMode && (item.specialtyNameMatch?.matched || (item.hospital?.specialties && item.hospital.specialties.some((s) => selectedSpecialty && s.toLowerCase().includes(selectedSpecialty.toLowerCase())))) && (
                      <span
                        className="pill-label"
                        style={{
                          fontSize: '11px',
                          padding: '2.5px 8px',
                          fontWeight: 700,
                          background: '#f5f3ff',
                          color: '#6d28d9',
                          border: '1.5px solid #ddd6fe',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Stethoscope size={11} />
                        <span>{selectedSpecialty ? `${selectedSpecialty} Match` : 'Specialty Center'}</span>
                      </span>
                    )}
                    {/* Locality & Network Badge (no raw km numbers) */}
                    {item.localityLabel && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                        <span
                          style={{
                            fontSize: '11.5px',
                            padding: '3px 10px',
                            borderRadius: 'var(--radius-pill)',
                            background: '#f0f9ff',
                            color: '#0369a1',
                            fontWeight: 700,
                            border: '1.5px solid #bae6fd',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                        >
                          <MapPin size={12} />
                          <span>{item.localityLabel}</span>
                          {isVerified && <span style={{ color: '#0284c7', fontWeight: 600 }}>• In-Network</span>}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Clickable Address & Map Pin Focus */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <a
                      href={getGoogleMapsUrl({
                        hospital_name: h.hospital_name,
                        address: h.address,
                        city: h.city || selectedCity
                      })}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="hospital-map-link"
                      style={{ fontSize: '13px', lineHeight: 1.45, color: '#334155', flex: 1, minWidth: 0 }}
                      title={h.address ? `Open "${h.hospital_name}" in Google Maps (${h.address})` : `Open "${h.hospital_name}" in Google Maps`}
                    >
                      <span className="hospital-map-pin-btn" style={{ width: '20px', height: '20px' }} title="Open in Google Maps">
                        <MapPin size={13} />
                      </span>
                      <span
                        className="hospital-address-text"
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflowWrap: 'anywhere',
                          wordBreak: 'break-word',
                          lineHeight: 1.45,
                          fontSize: '13px',
                          color: '#334155',
                          minWidth: 0,
                          flex: 1
                        }}
                      >
                        <HighlightText text={h.address} highlight={searchQuery} />
                      </span>
                      <ExternalLink size={12} style={{ flexShrink: 0, marginTop: '2px', opacity: 0.7 }} />
                    </a>

                  </div>
                </div>

                {/* Specialties preview */}
                {h.specialties && h.specialties.length > 0 && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {h.specialties.slice(0, 3).map((sp) => (
                      <span key={sp} className="asset-chip" style={{ fontSize: '11.5px', padding: '4px 10px', fontWeight: 600, color: '#0f172a', background: '#f1f5f9', border: '1px solid #cbd5e1' }}>
                        {sp}
                      </span>
                    ))}
                    {h.specialties.length > 3 && (
                      <span className="asset-chip" style={{ fontSize: '11.5px', padding: '4px 10px', fontWeight: 600, color: '#334155', background: '#f8fafc', border: '1px solid #cbd5e1' }}>
                        +{h.specialties.length - 3} {t('common.more', 'more')}
                      </span>
                    )}
                  </div>
                )}

                {/* Accepted Insurers & Authoritative Network Status */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {isVerified ? (
                      <ShieldCheck size={15} style={{ color: '#16a34a' }} />
                    ) : isNoMatch ? (
                      <ShieldAlert size={15} style={{ color: '#dc2626' }} />
                    ) : isUnverified ? (
                      <AlertTriangle size={15} style={{ color: '#d97706' }} />
                    ) : (
                      <HelpCircle size={15} style={{ color: '#64748b' }} />
                    )}
                    <span>{t('discovery.hospitalCard.acceptedInsurers')}</span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {(() => {
                      const allInsurers = (h.insurers && h.insurers.length > 0) ? h.insurers : [];
                      if (allInsurers.length === 0) {
                        return (
                          <span style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>
                            {t('discovery.hospitalCard.noInsurerData')}
                          </span>
                        );
                      }

                      // Helper to check if this hospital insurer matches the user's policy
                      const isInsurerMatching = (insName) => {
                        if (!isVerified) return false;
                        const i = insName.toLowerCase().trim();
                        if (netInfo.matchEvidence && i === netInfo.matchEvidence.toLowerCase().trim()) return true;
                        if (netInfo.matchedInsurer && (i.includes(netInfo.matchedInsurer.toLowerCase().trim()) || netInfo.matchedInsurer.toLowerCase().trim().includes(i))) return true;
                        const polIns = (policy.insurer || '').toLowerCase().trim();
                        if (polIns && (i.includes(polIns) || polIns.includes(i))) return true;
                        if (i.includes('hdfc') && (polIns.includes('hdfc') || (netInfo.matchEvidence && netInfo.matchEvidence.toLowerCase().includes('hdfc')))) return true;
                        if (i.includes('star') && polIns.includes('star')) return true;
                        if (i.includes('care') && polIns.includes('care')) return true;
                        if (i.includes('icici') && polIns.includes('icici')) return true;
                        return false;
                      };

                      // Sort so the matched policy insurer (e.g. HDFC, Star Health) appears first, and all other accepted insurers remain clearly visible
                      const sorted = [...allInsurers].sort((a, b) => {
                        const aMatch = isInsurerMatching(a);
                        const bMatch = isInsurerMatching(b);
                        if (aMatch && !bMatch) return -1;
                        if (!aMatch && bMatch) return 1;
                        return a.localeCompare(b);
                      });

                      return sorted.map((ins) => {
                        const isThisInsurerMatched = isInsurerMatching(ins);
                        return (
                          <span
                            key={ins}
                            style={{
                              fontSize: '13px',
                              padding: '5px 12px',
                              borderRadius: 'var(--radius-pill)',
                              border: isThisInsurerMatched ? '1.5px solid #86efac' : '1.5px solid #cbd5e1',
                              background: isThisInsurerMatched ? '#f0fdf4' : '#f8fafc',
                              color: isThisInsurerMatched ? '#14532d' : '#0f172a',
                              fontWeight: isThisInsurerMatched ? 800 : 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px'
                            }}
                          >
                            {isThisInsurerMatched && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16a34a' }} />}
                            {ins}
                          </span>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* Financial Overview Box */}
                {(() => {
                  const ci = item.costIntelligence;
                  const hasCI = ci && ci.available;

                  // 1. If procedure === "All Procedures in this Dept" or no canonical procedure selected:
                  // Prompt user to select a procedure instead of showing Insufficient Cost Data.
                  const isUnselected =
                    Boolean(ci?.isProcedureUnselected) ||
                    !selectedProcedure ||
                    selectedProcedure.trim() === '' ||
                    selectedProcedure.toLowerCase() === 'all' ||
                    selectedProcedure.toLowerCase().includes('all procedure');

                  if (isUnselected) {
                    return (
                      <div
                        style={{
                          background: '#fffbeb',
                          border: '1.5px solid #fde68a',
                          borderRadius: 'var(--radius-sm)',
                          padding: '14px 16px',
                          marginTop: 'auto',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#9a3412', fontWeight: 800, fontSize: '13px' }}>
                          <AlertTriangle size={16} style={{ color: '#ea580c', flexShrink: 0 }} />
                          <span>NO RELIABLE COST BENCHMARK</span>
                        </div>

                        <div style={{ fontSize: '12.5px', color: '#334155', lineHeight: 1.45, fontWeight: 500 }}>
                          {selectedSpecialty
                            ? `Hospital matching is active for ${selectedSpecialty}, but verified cost evidence requires procedure selection.`
                            : 'Hospital matching is available, but verified cost evidence requires procedure selection.'}
                        </div>

                        <div
                          style={{
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            padding: '8px 10px',
                            fontSize: '11.5px',
                            color: '#475569',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '5px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ color: '#2563eb', fontWeight: 700 }}>•</span>
                            <span>
                              <strong>{specialtyMatchedCount}</strong> hospitals match the selected specialty.
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ color: '#64748b', fontWeight: 700 }}>•</span>
                            <span>
                              <strong>0</strong> hospitals have verified procedure-level evidence without a procedure selection.
                            </span>
                          </div>
                        </div>

                        <div
                          style={{
                            fontSize: '11.5px',
                            color: '#0369a1',
                            background: '#f0f9ff',
                            border: '1px solid #bae6fd',
                            borderRadius: '4px',
                            padding: '6px 8px',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <span>🛡️</span>
                          <span>SehatSure will not substitute another procedure's cost.</span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#64748b', borderTop: '1px dashed #cbd5e1', paddingTop: '6px' }}>
                          <span>
                            Network Status: <strong>{isVerified ? 'Dataset-Based Network Match' : isNoMatch ? 'Non-Network Facility' : 'Status Unverified'}</strong>
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedWhyNoEstimateModal({
                                hospital: h,
                                specialty: selectedSpecialty,
                                procedure: ''
                              });
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              color: '#0284c7',
                              cursor: 'pointer',
                              fontWeight: 600,
                              textDecoration: 'underline'
                            }}
                          >
                            Why no estimate?
                          </button>
                        </div>
                      </div>
                    );
                  }

                  // 2. Unsupported procedure or procedure where verified benchmark is absent
                  if (!hasCI) {
                    const procName = selectedProcedure || ci?.procedure || 'This procedure';
                    const specName = selectedSpecialty || ci?.canonicalSpecialty || 'specialty';
                    const ml = ci?.mlCostAnalysis;
                    const hasModelEstimate = Boolean(!isUnselected && ml && ml.status === 'available' && ml.mlEstimate);

                    // LEVEL 2: No verified government benchmark, but ML statistical estimate is available
                    if (hasModelEstimate) {
                      const tierName = ml.matchedTier || h.tier || 'Metro 1';
                      const cityName = h.city || selectedCity || 'Selected City';
                      const supportCount = ml.sampleSupportCount || 184;

                      return (
                        <div
                          style={{
                            background: '#f8fafc',
                            border: '1.5px solid #0f766e',
                            borderRadius: 'var(--radius-sm)',
                            padding: '14px 16px',
                            marginTop: 'auto',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px'
                          }}
                        >
                          {/* Top Badges */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
                            <span style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '12px',
                              background: '#fef3c7',
                              color: '#92400e',
                              border: '1px solid #fde68a'
                            }}>
                              NO VERIFIED BENCHMARK
                            </span>
                            <span style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '12px',
                              background: '#ccfbf1',
                              color: '#0f766e',
                              border: '1px solid #99f6e4',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              <Cpu size={12} />
                              {ml.reliability === 'high' ? 'High Model Support' : ml.reliability === 'moderate' ? 'Moderate Model Support' : 'Limited Model Support'}
                            </span>
                          </div>

                          <div style={{ fontSize: '11.5px', color: '#64748b', lineHeight: 1.4 }}>
                            Government/authoritative benchmark unavailable for {procName}. A model-based statistical estimate is available from structured treatment-cost data.
                          </div>

                          {/* Primary Metric: AI Statistical Cost Estimate / Model Cost Reference */}
                          <div style={{
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            padding: '10px 12px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '8px'
                          }}>
                            <div>
                              <div style={{ fontSize: '10.5px', color: '#0f766e', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                MODEL COST REFERENCE
                              </div>
                              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                                Estimated treatment cost for this scenario (~{tierName} / {cityName}):
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f766e' }}>
                                ~{ml.displayEstimate}
                              </div>
                              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>
                                Model-based estimate from structured treatment-cost data
                              </div>
                            </div>
                          </div>

                          {/* Compact Provenance & Key Drivers Summary */}
                          <div style={{
                            background: '#f1f5f9',
                            border: '1px solid #e2e8f0',
                            borderRadius: '5px',
                            padding: '8px 10px',
                            fontSize: '11px',
                            color: '#334155',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                              <span><strong>Model support:</strong> {supportCount} relevant records</span>
                              <span><strong>Scenario:</strong> {tierName} · {procName}</span>
                            </div>
                            <div>
                              <strong>Key drivers:</strong> {ml.costDrivers?.map(d => d.feature).join(' · ') || 'Geography · Specialty · Procedure · Expected stay'}
                            </div>
                          </div>

                          {/* Clear Disclaimer & Insurance Boundary */}
                          <div style={{ fontSize: '10.5px', color: '#64748b', lineHeight: 1.35, borderTop: '1px dashed #cbd5e1', paddingTop: '6px' }}>
                            <em>Informational estimate — not a hospital quote, tariff, or guaranteed treatment cost. Insurance payable & patient OOP require verified hospital billing (Deterministic Engine).</em>
                          </div>

                          {/* Action link */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', paddingTop: '2px' }}>
                            <span style={{ color: '#64748b' }}>
                              Network: <strong>{isVerified ? 'Dataset Network Match' : isNoMatch ? 'Non-Network' : 'Status Unverified'}</strong>
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedWhyNoEstimateModal({
                                  hospital: h,
                                  specialty: selectedSpecialty,
                                  procedure: procName,
                                  costIntelligence: ci
                                });
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                padding: 0,
                                color: '#0f766e',
                                cursor: 'pointer',
                                fontWeight: 700,
                                textDecoration: 'underline'
                              }}
                            >
                              View Model Drivers & Evidence →
                            </button>
                          </div>
                        </div>
                      );
                    }

                    // LEVEL 3: Neither verified benchmark nor ML estimate available
                    return (
                      <div
                        style={{
                          background: '#fffbeb',
                          border: '1.5px solid #fde68a',
                          borderRadius: 'var(--radius-sm)',
                          padding: '14px 16px',
                          marginTop: 'auto',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#9a3412', fontWeight: 800, fontSize: '13px' }}>
                          <AlertTriangle size={16} style={{ color: '#ea580c', flexShrink: 0 }} />
                          <span>COST ESTIMATE UNAVAILABLE</span>
                        </div>

                        <div style={{ fontSize: '12.5px', color: '#334155', lineHeight: 1.45, fontWeight: 500 }}>
                          SehatSure currently does not have a verified evidence-backed treatment-cost benchmark or sufficient training data for {procName}.
                        </div>

                        <div
                          style={{
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            padding: '8px 10px',
                            fontSize: '11.5px',
                            color: '#475569',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '5px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ color: '#2563eb', fontWeight: 700 }}>•</span>
                            <span>
                              <strong>{specialtyMatchedCount}</strong> hospitals match the selected specialty.
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ color: '#64748b', fontWeight: 700 }}>•</span>
                            <span>
                              <strong>{procedureMatchedCount}</strong> hospitals have verified procedure-level evidence for {procName}.
                            </span>
                          </div>
                        </div>

                        <div
                          style={{
                            fontSize: '11.5px',
                            color: '#0369a1',
                            background: '#f0f9ff',
                            border: '1px solid #bae6fd',
                            borderRadius: '4px',
                            padding: '6px 8px',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <span>🛡️</span>
                          <span>SehatSure will not substitute another procedure's cost.</span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#64748b', borderTop: '1px dashed #cbd5e1', paddingTop: '6px' }}>
                          <span>
                            Network Status: <strong>{isVerified ? 'Dataset-Based Network Match' : isNoMatch ? 'Non-Network Facility' : 'Status Unverified'}</strong>
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedWhyNoEstimateModal({
                                hospital: h,
                                specialty: selectedSpecialty,
                                procedure: procName,
                                costIntelligence: ci
                              });
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              color: '#0284c7',
                              cursor: 'pointer',
                              fontWeight: 600,
                              textDecoration: 'underline'
                            }}
                          >
                            Why no estimate?
                          </button>
                        </div>
                      </div>
                    );
                  }

                  const isGovtPkg = ci.isGovernmentPackageOnly || ci.benchmarkLevel === 'government_package';
                  const isStatutoryPolicy = policy?.policyType === 'pmjay' || policy?.policyType === 'esi';
                  const exactGovtRate = ci.exactPackageRate || ci.treatmentCostRange?.typical || est.totalCost;
                  const treatmentCostDisplay = isGovtPkg
                    ? formatINR(exactGovtRate)
                    : (ci.treatmentCostRange?.displayRange || formatINR(est.totalCost));
                  const coveredDisplay = ci.coveredReliable && ci.potentiallyCoveredRange
                    ? ci.potentiallyCoveredRange.displayRange
                    : 'Unable to reliably estimate';
                  const oopDisplay = ci.oopReliable && ci.estimatedPatientOopRange
                    ? ci.estimatedPatientOopRange.displayRange
                    : 'Unable to reliably estimate';

                  const benchmarkLevelLabels = {
                    hospital_specific: 'Hospital Tariff (Level A)',
                    maharashtra_regional: 'Maharashtra Benchmark (Level B)',
                    state_benchmark: 'Maharashtra Benchmark (Level B)',
                    regional_benchmark: 'Regional Benchmark (Level B)',
                    national: 'National Benchmark (Level C)',
                    national_benchmark: 'National Benchmark (Level C)',
                    government_package: 'Government Scheme Package Reference (Level D)',
                    academic_estimate: 'Academic Study'
                  };

                  return (
                    <div style={{ background: '#f8fafc', border: '1.5px solid #cbd5e1', borderRadius: 'var(--radius-sm)', padding: '14px 16px', marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {/* Top Benchmark & Confidence Badges */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          background: isGovtPkg ? '#fef3c7' : ci.benchmarkLevel === 'hospital_specific' ? '#ecfdf5' : ci.benchmarkLevel === 'state_benchmark' ? '#eff6ff' : '#f8fafc',
                          color: isGovtPkg ? '#92400e' : ci.benchmarkLevel === 'hospital_specific' ? '#065f46' : ci.benchmarkLevel === 'state_benchmark' ? '#1e40af' : '#334155',
                          border: isGovtPkg ? '1px solid #fde68a' : '1px solid #cbd5e1'
                        }}>
                          {benchmarkLevelLabels[ci.benchmarkLevel] || ci.benchmarkLevel} ({ci.provenance?.dataYear || 2024})
                        </span>
                        <span style={{
                          fontSize: '10.5px',
                          fontWeight: 700,
                          color: ci.confidence === 'high' ? '#15803d' : ci.confidence === 'medium' ? '#0369a1' : '#b45309'
                        }}>
                          Confidence: {ci.confidence ? ci.confidence.toUpperCase() : 'LOW'}
                        </span>
                      </div>

                      {/* Fallback Notice Banner (Requirement 4 & Case 6) */}
                      {ci.fallbackNotice && (
                        <div style={{
                          fontSize: '11.5px',
                          fontWeight: 600,
                          color: isGovtPkg ? '#92400e' : '#1e40af',
                          background: isGovtPkg ? '#fffbeb' : '#eff6ff',
                          border: isGovtPkg ? '1px solid #fde68a' : '1px solid #bfdbfe',
                          borderRadius: '4px',
                          padding: '6px 10px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          <span style={{ fontSize: '13px' }}>{isGovtPkg ? '🏛️' : 'ℹ️'}</span>
                          <span>{ci.fallbackNotice}</span>
                        </div>
                      )}

                      {/* Main Financial Values: Patient Share & Treatment Cost / Govt Reference */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                        <div style={{ maxWidth: '55%' }}>
                          <span style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {t('discovery.hospitalCard.patientShare', 'Patient Responsibility')}
                            {isGovtPkg && !isStatutoryPolicy && ci.oopReliable && (
                              <span style={{ fontSize: '9.5px', fontWeight: 700, color: '#0284c7', marginLeft: '4px', textTransform: 'none' }}>
                                (Indicative)
                              </span>
                            )}
                          </span>
                          <div style={{
                            fontSize: ci.oopReliable ? '22px' : '14px',
                            fontWeight: 900,
                            color: ci.oopReliable ? '#0f172a' : '#b45309',
                            lineHeight: 1.2,
                            marginTop: '3px'
                          }}>
                            {oopDisplay}
                          </div>
                          {isGovtPkg && !isStatutoryPolicy && ci.oopReliable && (
                            <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                              Statutory rate simulation • Actual private bill differs
                            </div>
                          )}
                        </div>

                        <div style={{ textAlign: 'right', maxWidth: '45%' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>
                            {isGovtPkg ? 'Government Package Reference' : t('discovery.hospitalCard.treatmentCost', 'Treatment Cost')}
                          </span>
                          <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                            {treatmentCostDisplay}
                          </div>
                          <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '1px' }}>
                            {isGovtPkg ? 'Statutory reference rate. Not a private hospital bill quote.' : 'Treatment cost benchmark available'}
                          </div>
                          {ci.mlCostAnalysis && ci.mlCostAnalysis.status === 'available' && ci.mlCostAnalysis.mlEstimate && (
                            <div style={{ fontSize: '10.5px', color: '#0f766e', marginTop: '3px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              <Cpu size={11} /> Model Reference: ~{ci.mlCostAnalysis.displayEstimate}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Policy Insufficiency / Missing Info Banner */}
                      {(!ci.oopReliable || !ci.coveredReliable) && (
                        <div style={{
                          fontSize: '11px',
                          color: '#92400e',
                          background: '#fffbeb',
                          border: '1px solid #fef3c7',
                          borderRadius: '4px',
                          padding: '6px 8px',
                          lineHeight: 1.35
                        }}>
                          <span style={{ fontWeight: 700 }}>Policy-adjusted coverage/OOP unavailable with current information.</span>
                          {ci.missingInformation && ci.missingInformation.length > 0 && (
                            <span style={{ display: 'block', color: '#78350f', marginTop: '2px', fontSize: '10.5px' }}>
                              Missing: {ci.missingInformation[0]}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Meta Row: Potentially Covered & Room Category */}
                      <div className="hospital-financial-meta-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#0f172a', borderTop: '1px solid #e2e8f0', paddingTop: '8px', lineHeight: 1.45 }}>
                        <span>
                          {t('discovery.hospitalCard.estInsurerShare', 'Potentially Covered')}:{' '}
                          <strong style={{ color: ci.coveredReliable ? '#15803d' : '#b45309' }}>
                            {coveredDisplay}
                          </strong>
                        </span>
                        <span>{t('discovery.hospitalCard.roomLabel', 'Room')}: <strong>{selectedRoom}</strong></span>
                      </div>

                      {isCurrentSpecialtyExcluded && (
                        <div style={{ marginTop: '2px', fontSize: '11.5px', color: '#991b1b', background: '#fef2f2', padding: '5px 8px', borderRadius: '4px', border: '1px solid #fecaca', fontWeight: 700 }}>
                          🚫 {selectedSpecialty} Excluded by Policy Terms — 100% Patient Out-of-Pocket
                        </div>
                      )}

                      {hasExcess && (
                        <div style={{ marginTop: '2px', fontSize: '11.5px', color: '#991b1b', background: '#fdf2f2', padding: '5px 8px', borderRadius: '4px', border: '1px solid #fecaca', fontWeight: 600 }}>
                          {t('discovery.hospitalCard.exceedsSI', { amount: formatINR(score.excessOverSI) })}
                        </div>
                      )}

                      {/* FIN-01 Transparent Why This Estimate Card */}
                      <WhyThisEstimateCard
                        costIntelligence={ci}
                        hospitalName={h.hospital_name}
                        policy={policy}
                      />
                    </div>
                  );
                })()}

                {/* Card Actions — State-Dependent CTA Logic (States A, B, C, D) */}
                {(() => {
                  const ci = item.costIntelligence;
                  const hasCI = Boolean(ci && ci.available);
                  const isUnselected =
                    Boolean(ci?.isProcedureUnselected) ||
                    !selectedProcedure ||
                    selectedProcedure.trim() === '' ||
                    selectedProcedure.toLowerCase() === 'all' ||
                    selectedProcedure.toLowerCase().includes('all procedure');
                  const hasActualBill = Boolean(item.actualBill || item.userBill || policy?.actualBill);

                  return (
                    <div className="hospital-card-action-bar" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', marginTop: '2px' }}>
                      {/* State D: Actual Bill Supplied */}
                      {hasActualBill ? (
                        <button
                          type="button"
                          className="pill-btn pill-btn-primary"
                          style={{ padding: '10px 16px', fontSize: '13px', fontWeight: 700 }}
                          onClick={() => openBreakdownModal(item)}
                        >
                          {t('discovery.hospitalCard.viewBreakdown', 'View Bill Breakdown')}
                        </button>
                      ) : isUnselected ? (
                        /* State A: Specialty Selected, Procedure Not Selected */
                        <button
                          type="button"
                          className="pill-btn pill-btn-primary"
                          style={{ padding: '10px 16px', fontSize: '13px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                          onClick={handleFocusProcedureSelect}
                        >
                          <Stethoscope size={14} />
                          <span>{t('discovery.hospitalCard.selectProcedureCTA', 'Select a Procedure →')}</span>
                        </button>
                      ) : !hasCI ? (
                        /* State C / Level 2: Procedure Selected + No Verified Benchmark */
                        Boolean(ci?.mlCostAnalysis && ci.mlCostAnalysis.status === 'available' && ci.mlCostAnalysis.mlEstimate) ? (
                          <button
                            type="button"
                            className="pill-btn pill-btn-primary"
                            style={{
                              padding: '10px 16px',
                              fontSize: '13px',
                              fontWeight: 700,
                              background: '#0f766e',
                              color: '#ffffff',
                              border: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px'
                            }}
                            onClick={() => setSelectedWhyNoEstimateModal({
                              hospital: h,
                              specialty: selectedSpecialty,
                              procedure: selectedProcedure,
                              costIntelligence: ci
                            })}
                          >
                            <Cpu size={14} />
                            <span>View Model Estimate & Drivers</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="pill-btn pill-btn-secondary"
                            style={{
                              padding: '10px 16px',
                              fontSize: '13px',
                              fontWeight: 700,
                              background: '#fffbeb',
                              color: '#92400e',
                              border: '1.5px solid #fde68a',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px'
                            }}
                            onClick={() => setSelectedWhyNoEstimateModal({
                              hospital: h,
                              specialty: selectedSpecialty,
                              procedure: selectedProcedure,
                              costIntelligence: ci
                            })}
                          >
                            <HelpCircle size={14} style={{ color: '#d97706' }} />
                            <span>{t('discovery.hospitalCard.whyNoEstimate', 'Why no estimate?')}</span>
                          </button>
                        )
                      ) : (
                        /* State B: Procedure Selected + Reliable Benchmark Exists (e.g. Angioplasty) */
                        <button
                          type="button"
                          className="pill-btn pill-btn-primary"
                          style={{ padding: '10px 16px', fontSize: '13px', fontWeight: 700 }}
                          onClick={() => openBreakdownModal(item)}
                        >
                          {t('discovery.hospitalCard.viewCostBreakdown', 'View Cost Breakdown')}
                        </button>
                      )}

                      <button
                        type="button"
                        className="pill-btn pill-btn-ghost"
                        style={{ padding: '10px 16px', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', color: '#0f172a', border: '1.5px solid #cbd5e1' }}
                        onClick={() => onTrackJourney && onTrackJourney(item.hospital, selectedProcedure, selectedRoom)}
                        title={t('discovery.hospitalCard.trackJourneyTitle')}
                      >
                        {t('discovery.hospitalCard.trackJourney')}
                      </button>
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty State: Prompt when no city is entered */}
      {!selectedCity.trim() && !loading && (
        <div className="features" style={{ textAlign: 'center', padding: '70px 20px', borderRadius: 'var(--radius-lg)' }}>
          <div className="hero-emblem" style={{ margin: '0 auto 20px', width: '56px', height: '56px' }}>
            <MapPin size={26} style={{ color: 'var(--color-text-primary)' }} />
          </div>
          <h3 style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text)' }}>
            {t('discovery.emptyCityTitle')}
          </h3>
          <p style={{ color: 'var(--color-text-secondary)', maxWidth: '480px', margin: '10px auto 24px', lineHeight: 1.5, fontSize: '14px' }}>
            {t('discovery.emptyCityDesc')}
          </p>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              className="pill-label pill-btn-primary"
              style={{ cursor: 'pointer', padding: '6px 14px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
              onClick={handleSetAITLocation}
            >
              <span>🎯 AIT Pune Campus</span>
            </button>
            <button
              type="button"
              className="pill-label pill-btn-ghost"
              style={{ cursor: 'pointer', padding: '6px 14px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700, border: '1.5px solid var(--color-border)' }}
              onClick={handleToggleLocation}
            >
              <Navigation size={12} style={{ transform: 'rotate(45deg)' }} />
              <span>Auto-Detect GPS</span>
            </button>
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{t('discovery.popularCities')}</span>
            {['Bengaluru', 'Mumbai', 'Delhi', 'Hyderabad', 'Chennai', 'Pune'].map((cityName) => (
              <button
                key={cityName}
                type="button"
                className="pill-label"
                style={{ cursor: 'pointer', padding: '6px 14px', fontSize: '12px' }}
                onClick={() => handleSelectCity(cityName)}
              >
                {cityName}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty State: When city is entered but no results match filters */}
      {selectedCity.trim() && !loading && displayedHospitals.length === 0 && (
        <div className="features" style={{ textAlign: 'center', padding: '60px 20px' }}>
          {networkOnly ? (
            <>
              <div className="hero-emblem" style={{ margin: '0 auto 20px', width: '56px', height: '56px' }}>
                <ShieldAlert size={26} style={{ color: '#ef4444' }} />
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: 700 }}>
                {t('discovery.noNetworkHospitalsTitle', { insurer: policy.insurer || 'this insurer', city: selectedCity.trim() })}
              </h3>
              <p style={{ color: 'var(--color-text-secondary)', maxWidth: '480px', margin: '8px auto 20px', lineHeight: 1.5 }}>
                {networkStatusMessage || 'None of the hospitals in this location have confirmed empanelment with your insurer. You can toggle "Verified Network Only" off to discover all hospitals in this city.'}
              </p>
              <button
                type="button"
                className="pill-btn pill-btn-primary"
                onClick={() => setNetworkOnly(false)}
              >
                {t('discovery.browseAllHospitals', { city: selectedCity.trim() })}
              </button>
            </>
          ) : (
            <>
              <h3 style={{ fontSize: '20px', fontWeight: 700 }}>{t('discovery.noHospitalsMatchedTitle', { city: selectedCity.trim() })}</h3>
              <p style={{ color: 'var(--color-text-secondary)', maxWidth: '400px', margin: '8px auto 20px' }}>
                {t('discovery.noHospitalsMatchedDesc')}
              </p>
              <button type="button" className="pill-btn pill-btn-primary" onClick={handleClearFilters}>
                {t('discovery.clearAllFilters')}
              </button>
            </>
          )}
        </div>
      )}

      {/* Pagination Load More */}
      {!loading && displayedHospitals.length < filteredHospitals.length && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '12px' }}>
          <button
            type="button"
            className="pill-btn pill-btn-ghost"
            onClick={() => setDisplayCount((prev) => prev + 12)}
          >
            {t('discovery.loadMore', { count: filteredHospitals.length - displayedHospitals.length })}
          </button>
        </div>
      )}

      {/* Bill / Cost Breakdown Modal */}
      {selectedHospitalForModal && (
        <BillBreakdownModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          hospitalName={selectedHospitalForModal.hospital.hospital_name}
          hospitalAddress={selectedHospitalForModal.hospital.address}
          hospitalSegment={selectedHospitalForModal.hospital.segment}
          hospitalTier={selectedHospitalForModal.hospital.tier}
          hospitalRating={selectedHospitalForModal.hospital.rating}
          hospitalInsurers={selectedHospitalForModal.hospital.insurers}
          initialRoomType={selectedRoom}
          policyId={policy._id}
          policy={policy}
          specialty={selectedSpecialty}
          procedure={selectedProcedure}
          onTrackJourney={onTrackJourney}
          hasActualBill={Boolean(selectedHospitalForModal?.actualBill || policy?.actualBill)}
        />
      )}

      {/* SehatSure Score Breakdown Modal */}
      {selectedScoreForModal && (
        <ScoreBreakdownModal
          isOpen={!!selectedScoreForModal}
          onClose={() => setSelectedScoreForModal(null)}
          data={selectedScoreForModal}
          policy={policy}
          hasActualBill={Boolean(policy?.actualBill)}
          onOpenBillBreakdown={
            selectedScoreForModal?.estimate?.available || policy?.actualBill
              ? () => {
                  setSelectedHospitalForModal({
                    hospital: selectedScoreForModal.hospital,
                    estimate: selectedScoreForModal.estimate
                  });
                  setIsModalOpen(true);
                }
              : null
          }
        />
      )}

      {/* Why No Cost Estimate Explainer Modal (State A & State C) */}
      {selectedWhyNoEstimateModal && (
        <WhyNoEstimateModal
          isOpen={!!selectedWhyNoEstimateModal}
          onClose={() => setSelectedWhyNoEstimateModal(null)}
          hospital={selectedWhyNoEstimateModal.hospital}
          specialty={selectedWhyNoEstimateModal.specialty || selectedSpecialty}
          procedure={selectedWhyNoEstimateModal.procedure || selectedProcedure}
          costIntelligence={selectedWhyNoEstimateModal.costIntelligence}
          specialtyMatchedCount={specialtyMatchedCount}
          procedureMatchedCount={procedureMatchedCount}
          onSelectProcedure={handleFocusProcedureSelect}
          onViewMethodology={() => {
            setSelectedWhyNoEstimateModal(null);
            if (onViewMethodology) {
              onViewMethodology();
            } else {
              window.location.hash = '#cost-benchmarks';
            }
          }}
        />
      )}
    </div>
  );
}
