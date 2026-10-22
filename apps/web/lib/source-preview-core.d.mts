export type PreviewMatch={home:string|null;away:string|null;status:string|null};
export type ProviderPreview={
 provider:'footbolno'|'sportscore';
 count:number;
 updated:string|null;
 examples:PreviewMatch[];
};
export declare function summarizeFootbolno(payload:unknown):ProviderPreview;
export declare function summarizeSportScore(payload:unknown):ProviderPreview;
