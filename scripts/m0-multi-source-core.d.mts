// Types for the isomorphic, pure JavaScript evaluator next to this declaration.
export interface QualityMetric {
  compared: number;
  errors: number;
  errorRate: number|null;
  interval95: {lower:number;upper:number}|null;
}
export interface QualityEntry {
  sourceId:string;
  observed:number;
  missing:number;
  referenceCases:number;
  coverageRate:number|null;
  matchOrientation:QualityMetric;
  kickoff:QualityMetric;
  status:QualityMetric;
  finalScore:QualityMetric;
  fixtureIntegrity:QualityMetric;
  scheduledFixtureIntegrity:QualityMetric;
  prematchScheduleEvidence:{
    scheduledReferenceCases:number;
    documentedBySuppliedTimestamps:number;
    notDemonstrated:number;
    historicalProvenanceAuthenticated:false;
  };
  unscoredFinals:number;
  temporalAvailability:{
    demonstratedBySuppliedTimestamps:number;
    notDemonstrated:number;
    historicalProvenanceAuthenticated:false;
  };
  upstream:{
    declaredGroups:string[];
    unresolvedObservations:number;
    independenceAuthenticated:false;
  };
  provisionalScoreRankEligible:boolean;
}
export interface QualityReport {
  schemaVersion:1;
  interpretation:string;
  sourceApproval:false;
  sourceRightsApproved:false;
  officialReferenceAuthenticityVerified:false;
  upstreamIndependenceVerified:false;
  enabledForTraining:false;
  eligibleForProduction:false;
  observationCount:number;
  sources:QualityEntry[];
  fieldRankings:Record<string,Array<{
    sourceId:string;compared:number;errorRate:number;interval95:{lower:number;upper:number}|null;
  }>>;
  rankingBasis:string;
  minimumScoredMatches:number;
}
export function evaluateSourceEvidenceCore(
  input:unknown,
  registry:{
    sources:Array<{id:string;priority:number;active:boolean;authorizedAutomatedTraining:boolean}>;
    policy:{maxMonthlySpendUSD:number};
  },
  options?:{minimumScoredMatches?:number}
):QualityReport;
