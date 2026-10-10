// scripts/test_api_responses.mjs
async function run() {
  const testCases = [
    {
      name: 'State A: Specialty Neurology, Procedure unselected',
      payload: { city: 'Bengaluru', specialty: 'Neurology' }
    },
    {
      name: 'State B: Specialty Cardiology, Procedure Angioplasty (PTCA + 1 DES)',
      payload: { city: 'Pune', specialty: 'Cardiology', procedure: 'Angioplasty (PTCA + 1 DES)' }
    },
    {
      name: 'State C: Specialty Neurology, Procedure EEG',
      payload: { city: 'Bengaluru', specialty: 'Neurology', procedure: 'EEG' }
    }
  ];

  for (const tc of testCases) {
    console.log(`\n=== Testing: ${tc.name} ===`);
    const res = await fetch('http://localhost:5000/api/hospitals/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tc.payload)
    });
    const data = await res.json();
    console.log(`Total hospitals returned: ${data.hospitals?.length}`);
    console.log(`specialtyMatchedCount: ${data.specialtyMatchedCount}`);
    console.log(`procedureMatchedCount: ${data.procedureMatchedCount}`);
    if (data.hospitals && data.hospitals.length > 0) {
      const first = data.hospitals[0];
      console.log(`First hospital: ${first.hospital.hospital_name}`);
      console.log(`Estimate available: ${first.estimate?.available}`);
      console.log(`Cost Intelligence available: ${first.costIntelligence?.available}`);
      console.log(`isProcedureUnselected: ${first.costIntelligence?.isProcedureUnselected}`);
      if (first.costIntelligence?.available) {
        console.log(`Treatment cost range: ${first.costIntelligence.treatmentCostRange?.displayRange}`);
        console.log(`Benchmark Level: ${first.costIntelligence.benchmarkLevel}`);
      }
    }
  }
}

run().catch(console.error);
