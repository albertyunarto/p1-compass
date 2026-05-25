// Common Singapore parent shortforms → school name (as it appears in
// data/schools.json). Used by the search typeahead so "ACS" finds Anglo-Chinese
// School (Primary), "SJI" finds St. Joseph's Institution Junior, etc.

export const SCHOOL_ALIASES: Record<string, string[]> = {
  "Anglo-Chinese School (Primary)": ["ACS", "ACSP", "ACS Primary", "ACS (P)", "Anglo Chinese", "Anglo-Chinese Primary"],
  "Anglo-Chinese School (Junior)": ["ACSJ", "ACS Junior", "ACS (J)", "Anglo-Chinese Junior"],
  "Ai Tong School": ["AT", "Ai Tong"],
  "Anderson Primary School": ["APS", "Anderson"],
  "Bukit Timah Primary School": ["BTPS", "Bukit Timah"],
  "Bukit Panjang Primary School": ["BPPS", "Bukit Panjang"],
  "Catholic High School (Primary)": ["CHSP", "CHS", "CHS Primary", "Catholic High", "Catholic High Primary"],
  "CHIJ (Katong) Primary": ["CHIJK", "CHIJ Katong"],
  "CHIJ (Kellock)": ["CHIJ Kellock"],
  "CHIJ Our Lady of Good Counsel": ["CHIJ OLGC", "OLGC", "Good Counsel"],
  "CHIJ Our Lady of the Nativity": ["CHIJ Nativity", "OLN"],
  "CHIJ Our Lady Queen of Peace": ["CHIJ QP", "OLQP", "Queen of Peace"],
  "CHIJ Primary (Toa Payoh)": ["CHIJ Toa Payoh", "CHIJ TP"],
  "CHIJ St. Nicholas Girls' School (Primary)": ["CHIJSN", "St Nicholas", "St Nicks", "Nicholas Girls", "CHIJ Nicholas"],
  "Chongfu School": ["CF", "Chongfu"],
  "Chongzheng Primary School": ["CZPS", "Chongzheng"],
  "Fairfield Methodist School (Primary)": ["FMSP", "Fairfield"],
  "Geylang Methodist School (Primary)": ["GMSP", "Geylang Methodist"],
  "Haig Girls' School": ["HGS", "Haig Girls", "Haig"],
  "Henry Park Primary School": ["HPPS", "Henry Park"],
  "Holy Innocents' Primary School": ["HIPS", "Holy Innocents"],
  "Hougang Primary School": ["HPS", "Hougang"],
  "Kheng Cheng School": ["KCS", "Kheng Cheng"],
  "Kong Hwa School": ["KH", "KHS", "Kong Hwa"],
  "Kuo Chuan Presbyterian Primary School": ["KCPPS", "Kuo Chuan"],
  "Maha Bodhi School": ["MB", "MBS", "Maha Bodhi"],
  "Maris Stella High School (Primary)": ["MSHS", "MSH", "Maris Stella"],
  "Methodist Girls' School (Primary)": ["MGS", "MGSP", "Methodist Girls"],
  "Nan Hua Primary School": ["NHPS", "Nan Hua"],
  "Nanyang Primary School": ["NYPS", "Nanyang"],
  "Ngee Ann Primary School": ["NAPS", "Ngee Ann"],
  "Pasir Ris Primary School": ["PRPS", "Pasir Ris"],
  "Paya Lebar Methodist Girls' School (Primary)": ["PLMGS", "Paya Lebar", "PL MGS"],
  "Pei Chun Public School": ["PCPS", "Pei Chun"],
  "Pei Hwa Presbyterian Primary School": ["PHPPS", "Pei Hwa"],
  "Pei Tong Primary School": ["PTPS", "Pei Tong"],
  "Princess Elizabeth Primary School": ["PEPS", "Princess Elizabeth"],
  "Raffles Girls' Primary School": ["RGPS", "RGS Primary", "Raffles Girls"],
  "Red Swastika School": ["RSS", "Red Swastika"],
  "Rosyth School": ["RS", "Rosyth"],
  "Singapore Chinese Girls' Primary School": ["SCGS", "SCGPS"],
  "St. Andrew's Junior School": ["SAJS", "St Andrew", "Saint Andrew"],
  "St. Anthony's Canossian Primary School": ["SACPS", "St Anthony Canossian", "Anthony's Canossian"],
  "St. Anthony's Primary School": ["SAPS", "St Anthony", "Saint Anthony"],
  "St. Gabriel's Primary School": ["SGPS", "St Gabriel", "Saint Gabriel"],
  "St. Hilda's Primary School": ["SHPS", "St Hilda", "Saint Hilda"],
  "St. Joseph's Institution Junior": ["SJIJ", "SJI", "SJI Junior", "St Joseph Institution", "Saint Joseph"],
  "St. Margaret's School (Primary)": ["SMSP", "SMS", "St Margaret", "Saint Margaret"],
  "St. Stephen's School": ["SSS", "St Stephen", "Saint Stephen"],
  "Tampines Primary School": ["TamPS", "Tampines"],
  "Tanjong Katong Primary School": ["TKPS", "Tanjong Katong"],
  "Tao Nan School": ["TN", "TNS", "Tao Nan"],
  "Temasek Primary School": ["TPS", "Temasek"],
  "Yu Neng Primary School": ["YNPS", "Yu Neng"],
  "Yangzheng Primary School": ["YZPS", "Yangzheng"],
  "Zhonghua Primary School": ["ZHPS", "Zhonghua"],
};

/** Flat list of (alias → school name) pairs for fast iteration. */
export const ALIAS_INDEX: { alias: string; name: string }[] = (() => {
  const out: { alias: string; name: string }[] = [];
  for (const [name, aliases] of Object.entries(SCHOOL_ALIASES)) {
    for (const alias of aliases) out.push({ alias, name });
  }
  return out;
})();
