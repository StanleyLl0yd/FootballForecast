export type PreviewMatch={home:string|null;away:string|null;status:string|null};
export type ProviderPreview={
 provider:'footbolno'|'sportscore';
 count:number;
 updated:string|null;
 examples:PreviewMatch[];
};
export declare function summarizeFootbolno(payload:unknown):ProviderPreview;
export declare function summarizeSportScore(payload:unknown):ProviderPreview;

export type HistoricalAggregateDrift={
 baselineSHA256:string;referenceDate:string;
 homeDelta:number;awayDelta:number;finishedDelta:number;changed:boolean;
};
export type RplSeasonSummary={
 season:string;matches:number;finished:number;scheduled:number;live:number;cancelled:number;
 homeGoals:number;awayGoals:number;duplicates:number;duplicateMatchIds:number;
 missingTeams:number;invalidScores:number;invalidDates:number;invalidTimeFlags:number;
 pastScheduled:number;distinctClubCount:number;completeDirectedFixtureGrid:boolean;
 structuralCandidate:boolean;
 historicalAggregateDrift:HistoricalAggregateDrift|null;
};
export type UpcomingRplFixture={
 home:string;away:string;kickoffUtc:string;timeConfirmed:boolean;
};
export type RplCsvAudit={
 provider:'footbolno';checkedScope:'rpl-three-seasons';publisherRows:number;
 seasonSummaries:RplSeasonSummary[];
 upcomingFixtures:UpcomingRplFixture[];
 recordRevisionTimestampsAvailable:false;originalMatchRightsVerified:false;
 sourceMatchAccuracyVerified:false;modelTrainingApproved:false;
};
export declare function parseBoundedCsv(csv:string):{
 header:string[];rows:string[][];keys:Record<string,number>;
};
export declare function summarizeFootbolnoRplCsv(csv:string):RplCsvAudit;
