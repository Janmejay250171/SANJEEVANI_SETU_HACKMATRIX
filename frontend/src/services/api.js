export async function uploadPolicyPdf(file, onProgressStep) {
  const formData = new FormData();
  formData.append('file', file);

  if (onProgressStep) onProgressStep('Uploading…');

  const res = await fetch('/api/policy/upload', {
    method: 'POST',
    body: formData
  });

  const data = await res.json();

  if (!res.ok && res.status !== 422) {
    throw new Error(data.error?.message || 'Failed to upload and analyze policy.');
  }

  return data;
}

export async function getDemoPolicies() {
  const res = await fetch('/api/policy/demo');
  if (!res.ok) {
    throw new Error('Failed to fetch demo policies.');
  }
  return res.json();
}

export async function createPolicyFromDemo(key) {
  const res = await fetch(`/api/policy/demo/${key}`, {
    method: 'POST'
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to initialize demo policy.');
  }
  return data;
}

export async function getPolicy(id) {
  const res = await fetch(`/api/policy/${id}`);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Policy not found.');
  }
  return data;
}

export async function updatePolicy(id, updates) {
  const res = await fetch(`/api/policy/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updates)
  });

  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error?.message || 'Failed to save policy updates.');
    err.details = data.missingRequired || data.error?.details;
    throw err;
  }
  return data;
}

export async function deletePolicyApi(id) {
  const res = await fetch(`/api/policy/${id}`, {
    method: 'DELETE'
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to delete policy.');
  }
  return data;
}

export async function signupApi(name, email, password, confirmPassword) {
  const res = await fetch('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password, confirmPassword })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to sign up.');
  }
  return data;
}

export async function loginApi(email, password) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to log in.');
  }
  return data;
}

export async function getProfileApi(token) {
  const res = await fetch('/api/auth/profile', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to load profile.');
  }
  return data;
}

export async function toggleSaveHospitalApi(hospitalData, token) {
  const res = await fetch('/api/auth/saved-hospitals', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(hospitalData)
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to save hospital.');
  }
  return data;
}

export async function linkPolicyApi(policyId, token) {
  const res = await fetch('/api/auth/link-policy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ policyId })
  });
  return await res.json();
}

export async function askPolicyQuestionApi(policyId, message, history = [], overrides = null) {
  const res = await fetch(`/api/policy/${policyId}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ message, history, overrides })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || "SehatSure couldn't determine this from the available policy information.");
  }
  return data;
}

// ============================================================================
// FIN-01 Claim Adjudication, Bill Ingestion & Reassessment APIs
// ============================================================================

export async function uploadBillPdf(file) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch('/api/claims/bills/upload', {
    method: 'POST',
    body: formData
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to upload and parse itemized bill PDF.');
  }
  return data.data;
}

export async function getDemoClaimScenarios() {
  const res = await fetch('/api/claims/demo/scenarios');
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to fetch demonstration scenarios.');
  }
  return data.data;
}

export async function createClaimAssessment(payload, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch('/api/claims/assess', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error?.message || 'Failed to assess claim.');
    err.details = data.error?.details;
    throw err;
  }
  return data.data;
}

export async function getClaimAssessment(claimId, token = null) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api/claims/${claimId}`, { headers });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to retrieve claim assessment.');
  }
  return data.data;
}

export async function getClaimLedger(claimId, token = null) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api/claims/${claimId}/ledger`, { headers });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to retrieve claim ledger.');
  }
  return data.data;
}

export async function getClaimEvidence(claimId, token = null) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api/claims/${claimId}/evidence`, { headers });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to retrieve clause citations and evidence.');
  }
  return data.data;
}

export async function updateClaimItem(claimId, itemId, updates, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api/claims/${claimId}/items/${itemId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(updates)
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to update bill line item.');
  }
  return data.data;
}

export async function registerClaimAmendment(claimId, amendmentData, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api/claims/${claimId}/amendments`, {
    method: 'POST',
    headers,
    body: JSON.stringify(amendmentData)
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to register policy amendment.');
  }
  return data.data;
}

export async function reassessClaim(claimId, reassessmentReason, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api/claims/${claimId}/reassess`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ reassessmentReason })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to reassess claim.');
  }
  return data.data;
}

export async function compareClaimAssessments(claimId, baseAssessmentId = null, token = null) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const query = baseAssessmentId ? `?baseAssessmentId=${encodeURIComponent(baseAssessmentId)}` : '';
  const res = await fetch(`/api/claims/${claimId}/compare${query}`, { headers });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to compare assessments.');
  }
  return data.data;
}

export async function askAssistant({ message, history = [], context = {}, language = 'en', token = null }) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch('/api/assistant/chat', {
    method: 'POST',
    headers,
    body: JSON.stringify({ message, history, context, language })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to get answer from SehatSure assistant.');
  }
  return data.data;
}



