// State-by-state contractor insurance rules behind forsured.ai/coi-requirements/.
// tools/states/pages.js turns this file into the hub page and one page per state (built by
// node tools/blog/build.js, which also writes the sitemap and llms.txt). See README.md here.
//
// Every fact needs a source in that state's `sources` (or in SHARED below). Facts were checked
// against the state agency, statute or rule where we could reach it; where we relied on a
// secondary source, that source is listed. REVIEWED is the date the whole set was last checked.
//
// Fields
//   wc.at      short answer for the hub table ("1 employee", "3 employees; construction 1")
//   wc.short   one sentence: who must carry workers' comp
//   wc.detail  extra sentences (optional)
//   wc.agency  [name, url] of the state workers' comp agency
//   wc.mono    true where coverage comes only from a state fund (no private workers' comp)
//   lic        { at, short, detail? } on contractor licensing and the insurance it requires
//   ai         { cite, kind: 'sole' | 'broad' | 'none' | 'custom', text?, insure?: 'yes' | 'maybe' }
//              insure: the statute also limits insurance (additional insured) requirements
//              at: short answer for the hub table (custom kinds only; the others are derived)
//   notes      [{ h, p }] state-specific things worth knowing (optional)
//   sources    [{ title, publisher, url, date? }]

const REVIEWED = '2026-10-28';

const SHARED = {
  dol: { title: 'State Workers\' Compensation Officials', publisher: 'U.S. Department of Labor', url: 'https://www.dol.gov/agencies/owcp/wc' },
  grsm: { title: 'Anti-Indemnity Statutes in All 50 States (2023)', publisher: 'Gordon Rees Scully Mansukhani', url: 'https://grsm.com/wp-content/uploads/2023/10/Anti-Indemnity-Statutes-2023.pdf', date: '2023' },
  dm: { title: 'Another State Joins List of "Anti-Additional Insured" States', publisher: 'Duane Morris Construction Law Blog', url: 'https://blogs.duanemorris.com/constructionlaw/2012/01/05/another-state-joins-list-of-anti-additional-insured/', date: '2012' },
  irmi: { title: 'Contractual Insurance Requirements and Anti-Indemnity Statutes', publisher: 'IRMI', url: 'https://www.irmi.com/articles/expert-commentary/contractual-insurance-requirements-and-anti-indemnity-statutes', date: '2016' },
  stopgap: { title: 'What is stop gap coverage?', publisher: 'HUB International', url: 'https://www.hubinternational.com/en-us/insurance-glossary/s/stop-gap-coverage/' },
};

const onpay = (state, slug, date) => ({ title: `${state} workers' comp requirements`, publisher: 'OnPay', url: `https://onpay.com/insights/workers-comp-requirements-by-state/${slug}/`, date });

// Licensing line for states where we found no statewide insurance minimum tied to a general
// contractor license. Says what we looked for, not that none exists anywhere.
const noStateMinimum = (extra = '') => ({
  at: 'No statewide minimum',
  short: `We found no statewide general liability minimum tied to a general contractor license.${extra ? ` ${extra}` : ''} Cities and counties can set their own licensing and insurance rules, so check where the project is.`,
});

const STATES = [
  {
    name: 'Alabama', code: 'AL',
    wc: {
      at: '5 employees; new homes 1',
      short: 'Employers that regularly employ five or more people, counting corporate officers, must carry workers\' comp.',
      detail: 'The five-employee floor does not apply to building new single-family detached homes: employers doing that work need coverage at any headcount.',
      agency: ['Alabama Department of Labor, Workers\' Compensation Division', 'https://labor.alabama.gov/wc/insurance.aspx'],
    },
    lic: noStateMinimum(),
    ai: { cite: 'no statute; see Craig Constr. Co. v. Hendrix, 568 So. 2d 752 (Ala. 1990)', kind: 'none' },
    sources: [{ title: 'Workers\' compensation insurance requirements', publisher: 'Alabama Department of Labor', url: 'https://labor.alabama.gov/wc/insurance.aspx' }],
  },
  {
    name: 'Alaska', code: 'AK',
    wc: {
      at: '1 employee',
      short: 'Every employer with one or more employees in Alaska must carry workers\' comp, unless approved to self-insure.',
      detail: 'Sole proprietors, partners, and LLC members and corporate executive officers with at least 10% ownership don\'t have to cover themselves, but must cover everyone else who works for them.',
      agency: ['Alaska Division of Workers\' Compensation', 'https://labor.alaska.gov/wc/er-profit.html'],
    },
    lic: {
      at: '$50K/$100K BI, $20K PD',
      short: 'Alaska contractor registration requires general liability of at least $50,000 for injury to one person, $100,000 for injury to more than one, and $20,000 for property damage, plus a bond ($25,000 for a general contractor).',
    },
    ai: { cite: 'Alaska Stat. § 45.45.900', kind: 'sole' },
    sources: [
      { title: 'For-profit employers: workers\' compensation requirements', publisher: 'Alaska Department of Labor and Workforce Development', url: 'https://labor.alaska.gov/wc/er-profit.html' },
      { title: 'Construction contractor bond and insurance quick facts', publisher: 'Alaska Division of Corporations, Business and Professional Licensing', url: 'https://WWW.COMMERCE.ALASKA.GOV/web/Portals/5/pub/CON_BondInsuranceQuickFacts.pdf' },
    ],
  },
  {
    name: 'Arizona', code: 'AZ',
    wc: {
      at: '1 employee',
      short: 'Any employer that regularly hires workers in its usual business must carry workers\' comp, no matter how many, including part-time workers.',
      detail: 'A sole proprietor with no employees doesn\'t need to insure only themselves.',
      agency: ['Industrial Commission of Arizona', 'https://www.azica.gov/claims-division'],
    },
    lic: noStateMinimum('Arizona\'s Registrar of Contractors requires a license bond.'),
    ai: {
      cite: 'Ariz. Rev. Stat. §§ 32-1159 (private), 32-1159.01 (homes), 34-226 and 41-2586 (public)', at: 'Sole negligence; own negligence on public and home jobs',
      kind: 'custom',
      text: 'Arizona\'s private construction statute (Ariz. Rev. Stat. § 32-1159) voids clauses that make a contractor indemnify another party for that party\'s sole negligence. The rules reach further on public contracts (§§ 34-226 and 41-2586) and on private contracts for homes (§ 32-1159.01), where a clause can\'t make a contractor cover the other party\'s negligence at all. The home statute also limits what an additional insured endorsement has to pay for.',
    },
    sources: [
      { title: 'Workers\' compensation FAQs', publisher: 'Industrial Commission of Arizona', url: 'https://www.azica.gov/sites/default/files/media/FAQs%20version%20updated%205-2020%20%281%29.pdf', date: '2020' },
      { title: 'Ariz. Rev. Stat. § 32-1159', publisher: 'Arizona Legislature', url: 'https://www.azleg.gov/ars/32/01159.htm' },
      { title: 'Ariz. Rev. Stat. § 34-226', publisher: 'Arizona Legislature', url: 'https://www.azleg.gov/ars/34/00226.htm' },
    ],
  },
  {
    name: 'Arkansas', code: 'AR',
    wc: {
      at: '3 employees; building work 2',
      short: 'Most Arkansas employers with three or more employees must carry workers\' comp, and employers with two or more employees doing building or building repair work must too.',
      detail: 'A contractor that hands part of its contract to another contractor needs coverage with even one employee, and so does the contractor doing that part of the work.',
      agency: ['Arkansas Workers\' Compensation Commission', 'https://labor.arkansas.gov/workers-comp/awcc-about-us/basic-facts/'],
    },
    lic: noStateMinimum(),
    ai: { cite: 'Ark. Code Ann. §§ 4-56-104, 22-9-214', kind: 'sole' },
    sources: [
      { title: 'Basic facts', publisher: 'Arkansas Workers\' Compensation Commission', url: 'https://labor.arkansas.gov/workers-comp/awcc-about-us/basic-facts/' },
      { title: 'Who is required to carry workers compensation insurance in Arkansas?', publisher: 'Travelers', url: 'https://www.travelers.com/business-insurance/workers-compensation/state/arkansas' },
    ],
  },
  {
    name: 'California', code: 'CA',
    wc: {
      at: '1 employee',
      short: 'Every California employer with one or more employees must carry workers\' comp. Going without it is a crime.',
      detail: 'An uninsured employer faces a misdemeanor with a fine of at least $10,000, penalties of up to $100,000, and a stop order that bars using employee labor until coverage is in place.',
      agency: ['California Division of Workers\' Compensation', 'https://dir.ca.gov/DWC/faqs.html'],
    },
    lic: {
      at: 'Workers\' comp on file; LLCs $1M',
      short: 'The Contractors State License Board (CSLB) requires a workers\' comp certificate, or an exemption if the contractor has no employees, and a $25,000 license bond. Five license classifications must carry workers\' comp even with no employees: concrete (C-8), HVAC (C-20), asbestos abatement (C-22), roofing (C-39) and tree service (D-49).',
      detail: 'A law passed in 2021 (SB 216) set January 1, 2026 as the date every licensee would need workers\' comp, employees or not. A 2024 law (SB 1455) pushed that to January 1, 2028. Contractors licensed as LLCs must also carry at least $1 million in liability insurance (up to $5 million, depending on how many people are listed on the license).',
    },
    ai: {
      cite: 'Cal. Civ. Code §§ 2782, 2782.05', at: 'Sole negligence; active negligence on most private jobs',
      kind: 'custom',
      text: 'California Civil Code § 2782 voids construction clauses that make a contractor indemnify another party for that party\'s sole negligence or willful misconduct, with stricter limits on residential projects. For most private contracts signed since 2013, § 2782.05 also voids clauses that make a lower-tier contractor cover the active negligence of the contractor above it.',
    },
    notes: [{ h: 'The CSLB license is a quick check', p: 'A CSLB license lookup shows whether a contractor has a workers\' comp certificate or an exemption on file. A contractor claiming an exemption has told the state it has no employees, so if it shows up with a crew, ask.' }],
    sources: [
      { title: 'Answers to frequently asked questions about workers\' compensation for employers', publisher: 'California Department of Industrial Relations', url: 'https://dir.ca.gov/DWC/faqs.html' },
      { title: 'Industry bulletin: workers\' compensation requirements (SB 216)', publisher: 'Contractors State License Board', url: 'https://cslb.ca.gov/Resources/IndustryBulletins/2022/Industry_Bulletin_workers_comp.pdf', date: '2022' },
      { title: 'California governor signs bill to delay comp mandate for contractors', publisher: 'Business Insurance', url: 'https://www.businessinsurance.com/california-governor-signs-bill-to-delay-comp-mandate-for-contractors/', date: 'Sep 2024' },
      { title: 'Licenses for limited liability companies (LLC)', publisher: 'Contractors State License Board', url: 'https://web.cslb.ca.gov/About_Us/LLC.aspx' },
    ],
  },
  {
    name: 'Colorado', code: 'CO',
    wc: {
      at: '1 employee',
      short: 'All Colorado businesses with employees must carry workers\' comp, whatever the headcount, including part-time workers and family members.',
      agency: ['Colorado Division of Workers\' Compensation', 'https://cdle.colorado.gov/dwc'],
    },
    lic: noStateMinimum('Colorado has no statewide general contractor license.'),
    ai: { cite: 'Colo. Rev. Stat. § 13-21-111.5', kind: 'broad', insure: 'yes' },
    sources: [{ title: 'Division of Workers\' Compensation', publisher: 'Colorado Department of Labor and Employment', url: 'https://cdle.colorado.gov/dwc' }],
  },
  {
    name: 'Connecticut', code: 'CT',
    wc: {
      at: '1 employee',
      short: 'With few exceptions, every Connecticut employer must carry workers\' comp for its employees.',
      detail: 'Corporate officers, LLC members and partners can choose to be excluded. Out-of-state employers must cover workers who work in Connecticut.',
      agency: ['Connecticut Workers\' Compensation Commission', 'https://portal.ct.gov/wcc/knowledge-base/articles/employers/workers-compensation-insurance'],
    },
    lic: noStateMinimum(),
    ai: { cite: 'Conn. Gen. Stat. § 52-572k', kind: 'broad' },
    sources: [
      { title: 'About workers\' compensation insurance', publisher: 'Connecticut Workers\' Compensation Commission', url: 'https://portal.ct.gov/wcc/knowledge-base/articles/employers/workers-compensation-insurance' },
      { title: 'Conn. Gen. Stat. § 52-572k', publisher: 'Connecticut General Assembly', url: 'https://www.cga.ct.gov/current/pub/chap_925.htm#sec_52-572k' },
    ],
  },
  {
    name: 'Delaware', code: 'DE',
    wc: {
      at: '1 employee',
      short: 'Delaware employers with one or more employees must carry workers\' comp.',
      detail: 'Some workers are exempt, such as certain farm workers and casual employees. The state points to 19 Del. C. §§ 2307 and 2308 for the full list.',
      agency: ['Delaware Office of Workers\' Compensation', 'https://industrialaffairs.delaware.gov/workers-compensation-v1?hsLang=en-us'],
    },
    lic: noStateMinimum(),
    ai: { cite: 'Del. Code Ann. tit. 6, § 2704', kind: 'broad' },
    sources: [{ title: 'Workers\' compensation FAQs', publisher: 'Delaware Department of Labor, Office of Workers\' Compensation', url: 'https://industrialaffairs.delaware.gov/-workers-comp-faqs?hsLang=en#employers' }],
  },
  {
    name: 'District of Columbia', code: 'DC', slug: 'district-of-columbia',
    wc: {
      at: '1 employee',
      short: 'Employers with one or more employees in the District of Columbia must carry workers\' comp.',
      detail: 'Employers with staff working outside DC need a policy that covers those workers under the other states\' laws too.',
      agency: ['DC Office of Workers\' Compensation', 'https://does.dc.gov/page/workers-compensation-does'],
    },
    lic: noStateMinimum(),
    ai: { cite: 'no statute; see Parker v. John Moriarty & Assocs., 189 F. Supp. 3d 38 (D.D.C. 2016)', kind: 'none' },
    sources: [{ title: 'Office of Workers\' Compensation employer brochure', publisher: 'DC Department of Employment Services', url: 'https://does.dc.gov/sites/default/files/dc/sites/does/page_content/attachments/OWC%20Employer%20brochure.pdf' }],
  },
  {
    name: 'Florida', code: 'FL',
    wc: {
      at: '4 employees; construction 1',
      short: 'Construction businesses in Florida need workers\' comp with one or more employees, counting owners who are corporate officers or LLC members. Other businesses need it at four.',
      detail: 'Owners can opt out of coverage for themselves by getting an exemption from the Division of Workers\' Compensation. The exemption covers the owner, not the company\'s employees.',
      agency: ['Florida Division of Workers\' Compensation', 'https://www.myfloridacfo.com/division/WC/employer/coverage.htm'],
    },
    lic: {
      at: '$300K liability, $50K PD (GC)',
      short: 'Florida\'s Construction Industry Licensing Board requires certified and registered general and building contractors to carry at least $300,000 in public liability and $50,000 in property damage coverage. Residential contractors and most specialty trades need $100,000 and $25,000.',
    },
    ai: {
      cite: 'Fla. Stat. §§ 725.06, 725.08', at: 'Own negligence, unless capped',
      kind: 'custom',
      text: 'Florida Statutes § 725.06 voids construction clauses that make a contractor indemnify another party for that party\'s own negligence unless the clause carries a monetary limit that bears a reasonable commercial relationship to the contract and is part of the project specifications or bid documents. Section 725.08 sets separate limits for design professionals.',
    },
    notes: [{ h: 'Exemptions are common on Florida jobs', p: 'Because Florida construction owners can exempt themselves, you\'ll see contractors with an exemption certificate and no policy. That only works if the exempt owner is the only one on site. Anyone else working for that contractor needs coverage.' }],
    sources: [
      { title: 'Coverage requirements', publisher: 'Florida Division of Workers\' Compensation', url: 'https://www.myfloridacfo.com/division/WC/employer/coverage.htm' },
      { title: 'Fla. Admin. Code R. 61G4-15.003, Public liability insurance', publisher: 'Legal Information Institute', url: 'https://www.law.cornell.edu/regulations/florida/Fla-Admin-Code-Ann-R-61G4-15-003' },
      { title: 'Fla. Stat. § 725.06', publisher: 'The Florida Senate', url: 'https://www.flsenate.gov/Laws/Statutes/2025/725.06' },
    ],
  },
  {
    name: 'Georgia', code: 'GA',
    wc: {
      at: '3 employees',
      short: 'Georgia businesses with three or more workers, counting regular part-time workers, must carry workers\' comp.',
      agency: ['Georgia State Board of Workers\' Compensation', 'https://sbwc.georgia.gov/frequently-asked-questions/workers-compensation-law-faqs'],
    },
    lic: {
      at: '$500K GC; $300K residential',
      short: 'Georgia\'s licensing board requires general liability of at least $500,000 for general contractors and residential-light commercial contractors and $300,000 for residential-basic contractors, plus proof of workers\' comp as state law requires.',
    },
    ai: { cite: 'Ga. Code Ann. § 13-8-2(b)', kind: 'sole' },
    sources: [
      { title: 'Workers\' compensation law FAQs', publisher: 'Georgia State Board of Workers\' Compensation', url: 'https://sbwc.georgia.gov/frequently-asked-questions/workers-compensation-law-faqs' },
      { title: 'Ga. Comp. R. & Regs. 553-3 (residential contractor qualifications)', publisher: 'Georgia Secretary of State', url: 'https://rules.sos.ga.gov/gac/553-3' },
      { title: 'Ga. Comp. R. & Regs. 553-4-.01 (general contractor qualifications)', publisher: 'Justia Regulations', url: 'https://regulations.justia.com/states/georgia/department-553/chapter-553-4/rule-553-4-01/' },
    ],
  },
  {
    name: 'Hawaii', code: 'HI',
    wc: {
      at: '1 employee',
      short: 'Any Hawaii employer with one or more employees, full-time or part-time, permanent or temporary, must carry workers\' comp.',
      agency: ['Hawaii Disability Compensation Division', 'https://labor.hawaii.gov/dcd/?p=221'],
    },
    lic: {
      at: 'Liability required',
      short: 'Hawaii\'s Contractors License Board requires general liability insurance, and workers\' comp where it applies, to keep a contractor license. A lapse forfeits the license.',
    },
    ai: { cite: 'Haw. Rev. Stat. § 431:10-222', kind: 'sole' },
    sources: [
      { title: 'Workers\' compensation coverage', publisher: 'Hawaii Department of Labor and Industrial Relations', url: 'https://labor.hawaii.gov/dcd/?p=221' },
      { title: 'Contractors License Board', publisher: 'Hawaii Professional and Vocational Licensing', url: 'https://cca.hawaii.gov/pvl/2009' },
      { title: 'Haw. Rev. Stat. § 431:10-222', publisher: 'Hawaii State Legislature', url: 'https://www.capitol.hawaii.gov/hrscurrent/Vol09_Ch0431-0435H/HRS0431/HRS_0431-0010-0222.htm' },
    ],
  },
  {
    name: 'Idaho', code: 'ID',
    wc: {
      at: '1 employee',
      short: 'Idaho employers with one or more full-time, part-time, seasonal or occasional employees must carry workers\' comp before the first hire.',
      agency: ['Idaho Industrial Commission', 'https://iic.idaho.gov/employers/'],
    },
    lic: {
      at: '$300K single limit',
      short: 'Idaho contractor registration requires general liability, including products and completed operations, of at least $300,000 single limit, plus proof of workers\' comp or a statement of why it isn\'t required.',
    },
    ai: { cite: 'Idaho Code § 29-114', kind: 'sole' },
    sources: [
      { title: 'Employers FAQs', publisher: 'Idaho Industrial Commission', url: 'https://iic.idaho.gov/employer-compliance-division/employer-information/employers-faqs/' },
      { title: 'Contractor registration FAQ', publisher: 'Idaho Division of Occupational and Professional Licenses', url: 'https://dopl.idaho.gov/con/con-faq/' },
      { title: 'Idaho Code § 29-114', publisher: 'Idaho Legislature', url: 'https://legislature.idaho.gov/statutesrules/idstat/Title29/T29CH1/SECT29-114/' },
    ],
  },
  {
    name: 'Illinois', code: 'IL',
    wc: {
      at: '1 employee',
      short: 'Illinois law requires most employers to carry workers\' comp for their employees.',
      agency: ['Illinois Workers\' Compensation Commission', 'https://iwcc.illinois.gov/coverage.html'],
    },
    lic: noStateMinimum('Illinois has no statewide general contractor license.'),
    ai: { cite: '740 ILCS 35/1', kind: 'broad' },
    sources: [
      { title: 'Insurance coverage', publisher: 'Illinois Workers\' Compensation Commission', url: 'https://iwcc.illinois.gov/coverage.html' },
    ],
  },
  {
    name: 'Indiana', code: 'IN',
    wc: {
      at: '1 employee',
      short: 'Indiana businesses with employees must carry workers\' comp. The number of employees doesn\'t matter.',
      detail: 'Independent contractors aren\'t covered by the businesses that hire them. Indiana\'s Department of Revenue issues a workers\' comp exemption clearance certificate to independent contractors who aren\'t required to carry coverage.',
      agency: ['Workers\' Compensation Board of Indiana', 'https://www.in.gov/wcb/employers/'],
    },
    lic: noStateMinimum('Indiana has no statewide general contractor license.'),
    ai: { cite: 'Ind. Code §§ 26-2-5-1, 26-2-5-2', at: 'Sole negligence', kind: 'custom', text: 'Indiana Code § 26-2-5-1 voids construction clauses that make a contractor indemnify another party for that party\'s sole negligence. Highway contracts are treated differently (§ 26-2-5-2).' },
    sources: [
      onpay('Indiana', 'indiana', 'Dec 2025'),
      { title: 'Workers\' compensation clearance for contractors', publisher: 'Indiana Department of Revenue', url: 'https://in.gov/dor/i-am-a/business-corp/contractors/workers-comp' },
    ],
  },
  {
    name: 'Iowa', code: 'IA',
    wc: {
      at: '1 employee',
      short: 'Almost every Iowa business must carry workers\' comp from its first employee.',
      detail: 'Corporate officers can reject coverage for themselves in writing, up to four per corporation.',
      agency: ['Iowa Division of Workers\' Compensation', 'https://dial.iowa.gov/hearings/workers-comp'],
    },
    lic: noStateMinimum('Iowa requires contractors to register with the state.'),
    ai: { cite: 'Iowa Code § 537A.5', kind: 'broad' },
    sources: [
      { title: 'Workers\' compensation questions and answers', publisher: 'Iowa Division of Workers\' Compensation', url: 'https://dial.iowa.gov/media/8738/download?inline' },
      { title: 'Rejection of coverage', publisher: 'Iowa Division of Workers\' Compensation', url: 'https://dial.iowa.gov/hearings/workers-comp/compliance/reporting/rejection-coverage' },
      { title: 'Iowa Code § 537A.5', publisher: 'Iowa Legislature', url: 'https://www.legis.iowa.gov/docs/code/537A.5.pdf' },
    ],
  },
  {
    name: 'Kansas', code: 'KS',
    wc: {
      at: '$20K annual payroll',
      short: 'Kansas employers outside agriculture must carry workers\' comp once gross annual payroll passes $20,000.',
      agency: ['Kansas Division of Workers\' Compensation', 'https://www.dol.ks.gov/workers-compensation/overview'],
    },
    lic: noStateMinimum('Kansas has no statewide general contractor license.'),
    ai: { cite: 'Kan. Stat. Ann. § 16-121', kind: 'broad', insure: 'yes' },
    sources: [
      { title: 'Workers\' compensation overview', publisher: 'Kansas Department of Labor', url: 'https://www.dol.ks.gov/workers-compensation/overview' },
      { title: 'Kan. Stat. Ann. § 16-121', publisher: 'Kansas Office of Revisor of Statutes', url: 'https://www.ksrevisor.gov/statutes/chapters/ch16/016_001_0021.html' },
    ],
  },
  {
    name: 'Kentucky', code: 'KY',
    wc: {
      at: '1 employee',
      short: 'Kentucky employers with one or more workers, counting family, temporary and part-time workers, must carry workers\' comp.',
      detail: 'Out-of-state employers working in Kentucky need a policy that includes Kentucky coverage. An "all states" endorsement doesn\'t satisfy the rule.',
      agency: ['Kentucky Department of Workers\' Claims', 'https://elc.ky.gov/Workers-Compensation/'],
    },
    lic: noStateMinimum('Kentucky has no statewide general contractor license.'),
    ai: { cite: 'Ky. Rev. Stat. § 371.180', kind: 'broad' },
    sources: [
      { title: 'Employer frequently asked questions', publisher: 'Kentucky Department of Workers\' Claims', url: 'https://elc.ky.gov/Workers-Compensation/Pages/Employer-Frequently-Asked-Questions.aspx' },
      { title: 'Ky. Rev. Stat. § 371.180', publisher: 'Justia', url: 'https://law.justia.com/codes/kentucky/chapter-371/section-371-180/' },
    ],
  },
  {
    name: 'Louisiana', code: 'LA',
    wc: {
      at: '1 employee',
      short: 'Almost every Louisiana business with one or more employees, including part-time and seasonal workers, must carry workers\' comp.',
      agency: ['Louisiana Workforce Commission, Office of Workers\' Compensation', 'https://www.laworks.net/FAQs/FAQ_WorkComp_EmployerCoverage.asp'],
    },
    lic: {
      at: '$100K (residential)',
      short: 'Louisiana\'s licensing board requires residential and home improvement contractors to keep at least $100,000 in general liability and to show workers\' comp. Commercial license applicants don\'t file insurance with the board.',
    },
    ai: { cite: 'La. Rev. Stat. § 9:2780.1', kind: 'broad', insure: 'yes' },
    sources: [
      onpay('Louisiana', 'louisiana', 'May 2026'),
      { title: 'La. Rev. Stat. § 9:2780.1', publisher: 'Louisiana State Legislature', url: 'https://www.legis.la.gov/Legis/LawPrint.aspx?d=725435' },
      { title: 'Checklist of items required for initial license and to maintain license', publisher: 'Louisiana State Licensing Board for Contractors', url: 'https://lslbc.gov/checklist-of-items-required-for-initial-license-and-to-maintain-license/' },
    ],
  },
  {
    name: 'Maine', code: 'ME',
    wc: {
      at: '1 employee',
      short: 'Almost every Maine business with one or more employees must carry workers\' comp.',
      detail: 'An owner of at least 20% of a corporation\'s voting stock can waive coverage for themselves in writing, on a form the Workers\' Compensation Board approves.',
      agency: ['Maine Workers\' Compensation Board', 'https://www.maine.gov/wcb/'],
    },
    lic: noStateMinimum('Maine has no statewide general contractor license.'),
    ai: { cite: 'no statute; see Emery v. Waterhouse Co., 467 A.2d 986 (Me. 1983)', kind: 'none' },
    sources: [{ title: 'Employer\'s guide to workers\' compensation insurance in Maine', publisher: 'Maine Bureau of Insurance', url: 'https://www.maine.gov/pfr/insurance/sites/maine.gov.pfr.insurance/files/inline-files/Workers-Comp-Employer-Guide.pdf' }],
  },
  {
    name: 'Maryland', code: 'MD',
    wc: {
      at: '1 employee',
      short: 'With few exceptions, Maryland employers must carry workers\' comp for their employees.',
      agency: ['Maryland Workers\' Compensation Commission', 'https://www.wcc.state.md.us/'],
    },
    lic: {
      at: '$500K (home improvement)',
      short: 'Since June 1, 2024, Maryland home improvement contractors licensed by the Maryland Home Improvement Commission must carry at least $500,000 in general liability.',
    },
    ai: { cite: 'Md. Code Ann., Cts. & Jud. Proc. § 5-401', kind: 'sole' },
    sources: [
      { title: 'Frequently asked questions: employers', publisher: 'Maryland Workers\' Compensation Commission', url: 'https://www.wcc.state.md.us/Gen_Info/FAQ%20Employers.html' },
      { title: 'Maryland Home Improvement Commission', publisher: 'Maryland Department of Labor', url: 'https://labor.maryland.gov/license/mhic/index.shtml' },
      { title: 'Md. Code Ann., Cts. & Jud. Proc. § 5-401', publisher: 'Maryland General Assembly', url: 'https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gcj&section=5-401&enactments=false' },
    ],
  },
  {
    name: 'Massachusetts', code: 'MA',
    wc: {
      at: '1 employee',
      short: 'Every Massachusetts employer must carry workers\' comp for its employees, whatever the number of employees or hours worked.',
      detail: 'Corporate officers who own at least 25% of the company can file an affidavit of exemption for themselves.',
      agency: ['Massachusetts Department of Industrial Accidents', 'https://www.mass.gov/orgs/department-of-industrial-accidents'],
    },
    lic: noStateMinimum(),
    ai: { cite: 'Mass. Gen. Laws ch. 149, § 29C', at: 'Losses the contractor didn\'t cause', kind: 'custom', text: 'Massachusetts General Laws ch. 149, § 29C voids construction clauses that make a contractor indemnify another party for injury or damage that the contractor, its employees or the companies working under it did not cause.' },
    sources: [
      { title: 'Workers\' compensation insurance requirements', publisher: 'Massachusetts Department of Industrial Accidents', url: 'https://www.mass.gov/info-details/workers-compensation-insurance-requirements' },
      { title: 'Mass. Gen. Laws ch. 149, § 29C', publisher: 'Massachusetts Legislature', url: 'https://malegislature.gov/Laws/GeneralLaws/PartI/TitleXXI/Chapter149/Section29C' },
    ],
  },
  {
    name: 'Michigan', code: 'MI',
    wc: {
      at: '3 employees, or 1 full-time',
      short: 'Michigan private employers must carry workers\' comp if they regularly employ three or more people at one time, or one or more people for 35 hours a week for 13 weeks or more in the past year.',
      agency: ['Michigan Workers\' Disability Compensation Agency', 'https://www.michigan.gov/leo/bureaus-agencies/wdca/Insurance-Requirements/Pages/workers-disability-compensation-insurance-requirements'],
    },
    lic: noStateMinimum('Michigan licenses residential builders, without a liability insurance minimum.'),
    ai: { cite: 'Mich. Comp. Laws § 691.991', kind: 'sole' },
    sources: [
      { title: 'Workers\' disability compensation insurance requirements', publisher: 'Michigan Department of Labor and Economic Opportunity', url: 'https://www.michigan.gov/leo/bureaus-agencies/wdca/Insurance-Requirements/Pages/workers-disability-compensation-insurance-requirements' },
      { title: 'Mich. Comp. Laws § 691.991', publisher: 'Michigan Legislature', url: 'https://www.legislature.mi.gov/Laws/MCL?objectName=mcl-691-991' },
    ],
  },
  {
    name: 'Minnesota', code: 'MN',
    wc: {
      at: '1 employee',
      short: 'Minnesota has no minimum number of employees: almost every employer must carry workers\' comp, even for one part-time employee.',
      agency: ['Minnesota Department of Labor and Industry', 'https://www.dli.mn.gov/business/workers-compensation/work-comp-who-needs-workers-compensation-coverage'],
    },
    lic: {
      at: '$100K/$300K + $25K PD (residential)',
      short: 'Minnesota residential building contractors and remodelers must carry general liability of at least $100,000 per occurrence and $300,000 aggregate plus $25,000 in property damage, or a $300,000 single limit.',
    },
    ai: { cite: 'Minn. Stat. §§ 337.01 to 337.05', kind: 'broad' },
    sources: [
      { title: 'Who needs workers\' compensation coverage?', publisher: 'Minnesota Department of Labor and Industry', url: 'https://www.dli.mn.gov/business/workers-compensation/work-comp-who-needs-workers-compensation-coverage' },
      { title: 'Residential building contractor license application instructions (Minn. Stat. § 326B.86)', publisher: 'Minnesota Department of Labor and Industry', url: 'https://dli.mn.gov/sites/default/files/pdf/ccld_lic-01Inst.pdf' },
      { title: 'Minn. Stat. § 337.02', publisher: 'Minnesota Office of the Revisor of Statutes', url: 'https://www.revisor.mn.gov/statutes/cite/337.02' },
    ],
  },
  {
    name: 'Mississippi', code: 'MS',
    wc: {
      at: '5 employees',
      short: 'Mississippi employers with five or more regular employees must carry workers\' comp.',
      agency: ['Mississippi Workers\' Compensation Commission', 'https://mwcc.ms.gov/'],
    },
    lic: noStateMinimum(),
    ai: { cite: 'Miss. Code Ann. § 31-5-41', kind: 'broad' },
    sources: [{ title: 'Workers\' compensation facts', publisher: 'Mississippi Workers\' Compensation Commission', url: 'https://www.mwcc.ms.gov/pdf/WCFacts2013.pdf' }],
  },
  {
    name: 'Missouri', code: 'MO',
    wc: {
      at: '5 employees; construction 1',
      short: 'Missouri employers with five or more employees must carry workers\' comp. Construction employers that build, alter, demolish or repair improvements need it from the first employee.',
      agency: ['Missouri Division of Workers\' Compensation', 'https://labor.mo.gov/dwc/employers/insurance'],
    },
    lic: noStateMinimum('Missouri has no statewide general contractor license.'),
    ai: { cite: 'Mo. Rev. Stat. § 434.100', kind: 'broad' },
    sources: [
      { title: 'Who is required to carry workers\' compensation insurance coverage?', publisher: 'Missouri Department of Labor and Industrial Relations', url: 'https://labor.mo.gov/faqs/knowledge-base/who-required-carry-workers-compensation-insurance-coverage' },
      { title: 'Mo. Rev. Stat. § 434.100', publisher: 'Missouri Revisor of Statutes', url: 'https://revisor.mo.gov/main/OneSection.aspx?section=434.100' },
    ],
  },
  {
    name: 'Montana', code: 'MT',
    wc: {
      at: '1 employee',
      short: 'Montana\'s Workers\' Compensation Act applies to all employers and employees, with listed exceptions such as casual employment.',
      detail: 'Independent contractors must hold an Independent Contractor Exemption Certificate or their own coverage, and working without either can bring a fine of up to $5,000 per violation.',
      agency: ['Montana Department of Labor and Industry', 'https://erd.dli.mt.gov/'],
    },
    lic: noStateMinimum('Montana requires construction contractors to register with the state.'),
    ai: { cite: 'Mont. Code Ann. § 28-2-2111', kind: 'broad', insure: 'yes' },
    sources: [
      { title: 'Mont. Code Ann. § 39-71-401', publisher: 'Montana Legislature', url: 'https://mca.legmt.gov/bills/mca/title_0390/chapter_0710/part_0040/section_0010/0390-0710-0040-0010.html' },
      { title: 'Independent contractor exemption certificates', publisher: 'Montana Department of Labor and Industry', url: 'https://erd.dli.mt.gov/work-comp-regulations/montana-contractor/independent-contractor' },
      { title: 'Mont. Code Ann. § 28-2-2111', publisher: 'Montana Legislature', url: 'https://mca.legmt.gov/bills/mca/title_0280/chapter_0020/part_0210/section_0110/0280-0020-0210-0110.html' },
    ],
  },
  {
    name: 'Nebraska', code: 'NE',
    wc: {
      at: '1 employee',
      short: 'Nearly every Nebraska employer with one or more employees must carry workers\' comp.',
      agency: ['Nebraska Workers\' Compensation Court', 'https://www.newcc.gov/'],
    },
    lic: noStateMinimum('Nebraska requires contractors to register with the state.'),
    ai: { cite: 'Neb. Rev. Stat. § 25-21,187', kind: 'broad' },
    sources: [
      { title: 'Employer frequently asked questions', publisher: 'Nebraska Workers\' Compensation Court', url: 'https://www.newcc.gov/employers/employer-frequently-asked-questions' },
      { title: 'Neb. Rev. Stat. § 25-21,187', publisher: 'Nebraska Legislature', url: 'https://nebraskalegislature.gov/laws/statutes.php?statute=25-21,187' },
    ],
  },
  {
    name: 'Nevada', code: 'NV',
    wc: {
      at: '1 employee',
      short: 'Any Nevada employer with at least one employee must carry workers\' comp.',
      detail: 'The state\'s employer guide singles out construction trades: they must carry workers\' comp even where other businesses could claim an exemption.',
      agency: ['Nevada Division of Industrial Relations', 'https://dir.nv.gov/WCS/home/'],
    },
    lic: {
      at: 'Workers\' comp proof',
      short: 'The Nevada State Contractors Board won\'t issue or renew a license without proof of workers\' comp, or a sworn statement that the contractor has no employees and won\'t work for or bid to another contractor. A license bond is also required.',
    },
    ai: { cite: 'Nev. Rev. Stat. § 40.693', at: 'Residential contracts only', kind: 'custom', text: 'Nevada\'s statute (Nev. Rev. Stat. § 40.693) limits indemnity and defense clauses in residential construction contracts signed since February 24, 2015. Commercial contracts are judged under general contract law.' },
    sources: [
      { title: 'Employer\'s guide to workers\' compensation', publisher: 'Nevada Division of Industrial Relations', url: 'https://dir.nv.gov/uploadedFiles/dirnvgov/content/WCS/EmployersDocs/EmployerBrochure.7.2026.pdf', date: '2026' },
      { title: 'NRS 624.256, Proof of industrial insurance', publisher: 'Nevada Legislature (via Public.Law)', url: 'https://nevada.public.law/statutes/nrs_624.256' },
    ],
  },
  {
    name: 'New Hampshire', code: 'NH',
    wc: {
      at: '1 employee',
      short: 'New Hampshire employers with one or more full-time or part-time employees must carry workers\' comp.',
      detail: 'Up to three owners, members or executive officers can be excluded, but only through paperwork the insurer files with the Department of Labor. A sole proprietor isn\'t required to cover themselves.',
      agency: ['New Hampshire Department of Labor', 'https://www.dol.nh.gov/workers-compensation/employer-information'],
    },
    lic: noStateMinimum('New Hampshire has no statewide general contractor license.'),
    ai: { cite: 'N.H. Rev. Stat. Ann. §§ 338-A:1, 338-A:2', kind: 'broad' },
    sources: [{ title: 'Workers\' compensation FAQs', publisher: 'New Hampshire Insurance Department', url: 'https://insurance.nh.gov/consumers/business-insurance/workers-compensation/faqs' }],
  },
  {
    name: 'New Jersey', code: 'NJ',
    wc: {
      at: '1 employee',
      short: 'Every New Jersey employer not covered by a federal program must carry workers\' comp.',
      detail: 'A corporation needs coverage as soon as anyone works for it, corporate officers included. Partners, LLC members and sole proprietors don\'t count themselves, so their coverage starts with the first worker who isn\'t an owner.',
      agency: ['New Jersey Division of Workers\' Compensation', 'https://www.nj.gov/labor/workerscompensation/employer-requirements/index.shtml?open=insurance'],
    },
    lic: {
      at: '$500K (home improvement)',
      short: 'New Jersey home improvement contractors must register with the Division of Consumer Affairs and carry commercial general liability of at least $500,000 per occurrence.',
    },
    ai: { cite: 'N.J. Stat. Ann. §§ 2A:40A-1, 2A:40A-2', kind: 'sole' },
    sources: [
      { title: 'Employer requirements: insurance', publisher: 'New Jersey Division of Workers\' Compensation', url: 'https://www.nj.gov/labor/workerscompensation/employer-requirements/index.shtml?open=insurance' },
      { title: 'Home improvement contractor FAQ', publisher: 'New Jersey Division of Consumer Affairs', url: 'https://njconsumeraffairs.gov/hic/Pages/FAQ.aspx' },
    ],
  },
  {
    name: 'New Mexico', code: 'NM',
    wc: {
      at: '3 employees; construction 1',
      short: 'New Mexico businesses with three or more workers must carry workers\' comp. Contractors licensed under the Construction Industries Licensing Act need it regardless of headcount.',
      detail: 'The construction rule applies to out-of-state contractors working in New Mexico too.',
      agency: ['New Mexico Workers\' Compensation Administration', 'https://workerscomp.nm.gov/node/49'],
    },
    lic: noStateMinimum(),
    ai: { cite: 'N.M. Stat. Ann. §§ 56-7-1, 56-7-2', kind: 'broad', insure: 'yes' },
    sources: [{ title: 'Determining insurance coverage', publisher: 'New Mexico Workers\' Compensation Administration', url: 'https://workerscomp.nm.gov/node/49' }],
  },
  {
    name: 'New York', code: 'NY',
    wc: {
      at: '1 employee',
      short: 'Virtually every New York employer must carry workers\' comp, including for part-time, temporary, leased and family workers.',
      detail: 'Sole proprietors and partnerships with no employees, and certain one- or two-owner corporations with no other workers, don\'t have to.',
      agency: ['New York State Workers\' Compensation Board', 'https://www.wcb.ny.gov/content/main/coverage-requirements-wc/wc-coverage-required.jsp'],
    },
    lic: noStateMinimum('New York has no statewide general contractor license; New York City and other localities license contractors.'),
    ai: { cite: 'N.Y. Gen. Oblig. Law §§ 5-322.1, 5-324', kind: 'broad' },
    notes: [{ h: 'ACORD certificates don\'t prove New York workers\' comp to the government', p: 'When a business applies for a permit, license or public contract in New York, the agency has to see the state\'s own forms: C-105.2 (or U-26.3 from the State Insurance Fund) for workers\' comp, DB-120.1 for disability and paid family leave, or CE-200 for an exemption. The Workers\' Compensation Board says ACORD forms are not acceptable proof under Workers\' Compensation Law § 57.' }],
    sources: [
      { title: 'Workers\' compensation coverage requirements', publisher: 'New York State Workers\' Compensation Board', url: 'https://www.wcb.ny.gov/content/main/coverage-requirements-wc/wc-coverage-required.jsp' },
      { title: 'Requirements for businesses applying for government permits, licenses or contracts', publisher: 'New York State Workers\' Compensation Board', url: 'https://WWW.WCB.NY.GOV/content/main/Employers/requirements-businesses-applying-government-permits-licenses-contracts.pdf' },
      { title: 'N.Y. Gen. Oblig. Law § 5-322.1', publisher: 'New York State Senate', url: 'https://www.nysenate.gov/legislation/laws/GOB/5-322.1' },
    ],
  },
  {
    name: 'North Carolina', code: 'NC',
    wc: {
      at: '3 employees',
      short: 'North Carolina businesses that regularly employ three or more people must carry workers\' comp. Corporate officers count toward the three, even if they exclude themselves.',
      agency: ['North Carolina Industrial Commission', 'https://ic.nc.gov/wcinsrqmt.html'],
    },
    lic: noStateMinimum('North Carolina\'s general contractor license has financial requirements but no liability insurance minimum we could find.'),
    ai: { cite: 'N.C. Gen. Stat. § 22B-1', kind: 'broad' },
    sources: [
      { title: 'Employers\' obligation to obtain and maintain workers\' compensation coverage', publisher: 'North Carolina Industrial Commission', url: 'https://ic.nc.gov/wcinsrqmt.html' },
      { title: 'N.C. Gen. Stat. § 22B-1', publisher: 'North Carolina General Assembly', url: 'https://www.ncleg.gov/EnactedLegislation/Statutes/HTML/BySection/Chapter_22B/GS_22B-1.html' },
    ],
  },
  {
    name: 'North Dakota', code: 'ND',
    wc: {
      at: '1 employee (state fund)',
      short: 'Any business with employees working in North Dakota must have workers\' comp, and it can only come from the state fund, Workforce Safety & Insurance (WSI).',
      agency: ['North Dakota Workforce Safety & Insurance', 'https://www.workforcesafety.com/'],
      mono: true,
    },
    lic: {
      at: 'Liability certificate + WSI',
      short: 'North Dakota requires a contractor license for jobs over $4,000. The application needs a certificate of liability insurance with the Secretary of State as certificate holder and a WSI certificate of payment or letter of good standing.',
    },
    ai: { cite: 'N.D. Cent. Code §§ 9-08-02, 9-08-02.1, 22-02-02, 22-02-03', at: 'No general statute', kind: 'custom', text: 'North Dakota has no general construction anti-indemnity statute. Its laws void indemnity for intentional or unlawful acts (N.D. Cent. Code § 9-08-02) and limit clauses that shift an owner\'s design errors onto a contractor (§ 9-08-02.1).' },
    sources: [
      { title: 'Coverage requirements', publisher: 'North Dakota Workforce Safety & Insurance', url: 'https://www.workforcesafety.com/employers/insurance-coverage-information/coverage-requirements' },
      { title: 'Contractors', publisher: 'North Dakota Secretary of State', url: 'https://sos.nd.gov/business/contractors' },
      SHARED.stopgap,
      { title: 'N.D. Cent. Code ch. 9-08', publisher: 'North Dakota Legislative Branch', url: 'https://ndlegis.gov/cencode/t09c08.pdf' },
    ],
  },
  {
    name: 'Ohio', code: 'OH',
    wc: {
      at: '1 employee (state fund)',
      short: 'Ohio employers with employees must carry workers\' comp through the Ohio Bureau of Workers\' Compensation (BWC) or be approved to self-insure. Private carriers can\'t write it.',
      agency: ['Ohio Bureau of Workers\' Compensation', 'https://info.bwc.ohio.gov/for-employers'],
      mono: true,
    },
    lic: noStateMinimum('Ohio has no statewide general contractor license.'),
    ai: { cite: 'Ohio Rev. Code Ann. § 2305.31', kind: 'broad' },
    sources: [
      { title: 'For employers', publisher: 'Ohio Bureau of Workers\' Compensation', url: 'https://info.bwc.ohio.gov/for-employers' },
      { title: 'Self-insurance program description', publisher: 'Ohio Bureau of Workers\' Compensation', url: 'https://bwc.ohio.gov/employer/programs/siinfo/siprogramdescription.asp' },
      SHARED.stopgap,
      { title: 'Ohio Rev. Code § 2305.31', publisher: 'Ohio Legislative Service Commission', url: 'https://codes.ohio.gov/ohio-revised-code/section-2305.31' },
    ],
  },
  {
    name: 'Oklahoma', code: 'OK',
    wc: {
      at: '1 employee',
      short: 'Any Oklahoma employer with at least one full-time or part-time employee must carry workers\' comp.',
      detail: 'A business with five or fewer employees, all related to the owner by blood or marriage, is exempt if the owner is an individual, a partnership or the incorporator of the corporation.',
      agency: ['Oklahoma Workers\' Compensation Commission', 'https://www.wcc.ok.gov/'],
    },
    lic: noStateMinimum('Oklahoma has no statewide general contractor license.'),
    ai: { cite: 'Okla. Stat. tit. 15, § 221', kind: 'broad', insure: 'yes' },
    sources: [
      { title: 'Guide for employers', publisher: 'Oklahoma Workers\' Compensation Commission', url: 'https://www.ok.gov/wcc/documents/Guide%20for%20Employers%20FINAL.pdf' },
      { title: 'Okla. Stat. tit. 15, § 221', publisher: 'Justia', url: 'https://law.justia.com/codes/oklahoma/title-15/section-15-221/' },
    ],
  },
  {
    name: 'Oregon', code: 'OR',
    wc: {
      at: '1 employee',
      short: 'Nearly every Oregon employer with one or more workers must carry workers\' comp.',
      agency: ['Oregon Workers\' Compensation Division', 'https://wcd.oregon.gov/employer/Pages/index.aspx'],
    },
    lic: {
      at: '$500K residential GC; $2M commercial L1',
      short: 'Oregon\'s Construction Contractors Board sets liability minimums by endorsement: $500,000 per occurrence for a residential general contractor, $1,000,000 aggregate for a commercial general contractor level 2, and $2,000,000 aggregate for level 1.',
    },
    ai: { cite: 'Or. Rev. Stat. § 30.140', kind: 'broad', insure: 'yes' },
    sources: [
      { title: 'Workers\' compensation insurance overview', publisher: 'Oregon Workers\' Compensation Division', url: 'https://wcd.oregon.gov/employer/Pages/compensation-insurance-overview.aspx' },
      { title: 'OAR 812-003-0221, Liability insurance requirements', publisher: 'Oregon Construction Contractors Board (via Public.Law)', url: 'https://oregon.public.law/rules/oar_812-003-0221' },
      { title: 'Or. Rev. Stat. ch. 30 (§ 30.140)', publisher: 'Oregon State Legislature', url: 'https://www.oregonlegislature.gov/bills_laws/ors/ors030.html' },
    ],
  },
  {
    name: 'Pennsylvania', code: 'PA',
    wc: {
      at: '1 employee',
      short: 'Pennsylvania employers with one or more workers, including part-time, seasonal and family employees, must carry workers\' comp.',
      detail: 'Corporate officers must be included unless an approved exemption is on file.',
      agency: ['Pennsylvania Bureau of Workers\' Compensation', 'https://www.pa.gov/en/agencies/dli/programs-services/workers-compensation.html'],
    },
    lic: {
      at: '$50K BI + $50K PD (home improvement)',
      short: 'Pennsylvania home improvement contractors must register with the Attorney General and carry at least $50,000 in personal injury liability and $50,000 in property damage coverage.',
    },
    ai: { cite: 'Pa. Stat. Ann. tit. 68, § 491', at: 'Design professionals only', kind: 'custom', text: 'Pennsylvania\'s statute (68 P.S. § 491) covers clauses that indemnify design professionals for their own errors. For other construction clauses, Pennsylvania courts enforce indemnity for a party\'s own negligence only when the clause says so clearly.' },
    sources: [
      onpay('Pennsylvania', 'pennsylvania', 'May 2026'),
      { title: 'Contractor frequently asked questions', publisher: 'Pennsylvania Office of Attorney General', url: 'https://www.attorneygeneral.gov/?p=6380' },
    ],
  },
  {
    name: 'Rhode Island', code: 'RI',
    wc: {
      at: '1 employee',
      short: 'Rhode Island employers with one or more employees must carry workers\' comp. Individual owners and partners are exempt.',
      agency: ['Rhode Island Department of Labor and Training', 'https://dlt.ri.gov/wc/employers/'],
    },
    lic: {
      at: '$500K liability',
      short: 'Rhode Island contractor registration requires a $500,000 liability insurance certificate naming the Contractors\' Registration and Licensing Board, plus a workers\' comp certificate for contractors with employees.',
    },
    ai: { cite: 'R.I. Gen. Laws § 6-34-1', kind: 'broad' },
    sources: [
      { title: 'Employers', publisher: 'Rhode Island Department of Labor and Training', url: 'https://dlt.ri.gov/wc/employers/' },
      { title: 'Contractor registration FAQs', publisher: 'Rhode Island Contractors\' Registration and Licensing Board', url: 'https://crb.ri.gov/contractor-registration/faqs' },
      { title: 'R.I. Gen. Laws § 6-34-1', publisher: 'Rhode Island General Assembly', url: 'https://webserver.rilegislature.gov/Statutes/TITLE6/6-34/6-34-1.htm' },
    ],
  },
  {
    name: 'South Carolina', code: 'SC',
    wc: {
      at: '4 employees',
      short: 'South Carolina employers with four or more employees in the state, counting part-time workers and family, must carry workers\' comp. Businesses with annual payroll under $3,000 are exempt.',
      agency: ['South Carolina Workers\' Compensation Commission', 'https://wcc.sc.gov/employer-faqs'],
    },
    lic: noStateMinimum(),
    ai: { cite: 'S.C. Code Ann. § 32-2-10', kind: 'sole' },
    sources: [
      { title: 'Employer FAQs', publisher: 'South Carolina Workers\' Compensation Commission', url: 'https://wcc.sc.gov/employer-faqs' },
      { title: 'S.C. Code Ann. tit. 32, ch. 2 (§ 32-2-10)', publisher: 'South Carolina Legislature', url: 'https://www.scstatehouse.gov/code/t32c002.php' },
    ],
  },
  {
    name: 'South Dakota', code: 'SD',
    wc: {
      at: 'Not required by law',
      short: 'No South Dakota law requires employers to carry workers\' comp. The state strongly recommends it, and an uninsured employer can be sued in civil court by an injured worker.',
      agency: ['South Dakota Department of Labor and Regulation', 'https://dlr.sd.gov/workers_compensation/default.aspx'],
    },
    lic: noStateMinimum('South Dakota has no statewide general contractor license.'),
    ai: { cite: 'S.D. Codified Laws §§ 56-3-16, 56-3-18', kind: 'sole' },
    notes: [{ h: 'The state won\'t make them carry it, so the project has to', p: 'Because workers\' comp is optional in South Dakota, your project requirements are the only thing that makes a contractor carry it. Spell out workers\' comp and employers liability limits, and check that the COI shows them.' }],
    sources: [{ title: 'Workers\' compensation', publisher: 'South Dakota Department of Labor and Regulation', url: 'https://dlr.sd.gov/workers_compensation/default.aspx' }],
  },
  {
    name: 'Tennessee', code: 'TN',
    wc: {
      at: '5 employees; construction 1',
      short: 'Tennessee construction employers with one or more employees must carry workers\' comp, and construction business owners must cover themselves too unless they qualify for an exemption.',
      detail: 'Outside construction and coal mining, the threshold is five employees. Exempt construction owners are listed on the state\'s Exemption Registry, and the exemption covers only that person.',
      agency: ['Tennessee Bureau of Workers\' Compensation', 'https://www.tn.gov/workforce/injuries-at-work/employers/employers/who-must-carry-insurance/construction.html'],
    },
    lic: noStateMinimum('Tennessee\'s contractor license has financial requirements but no liability insurance minimum we could find.'),
    ai: { cite: 'Tenn. Code Ann. § 62-6-123', kind: 'sole' },
    notes: [{ h: 'Check the Exemption Registry', p: 'A Tennessee construction exemption covers only the owner named on it, not the business or its employees. If a contractor gives you an exemption instead of a COI, look it up on the Exemption Registry and confirm nobody else from that company works on your site.' }],
    sources: [
      { title: 'Construction industry workers\' compensation requirements', publisher: 'Tennessee Department of Labor and Workforce Development', url: 'https://www.tn.gov/workforce/injuries-at-work/employers/employers/who-must-carry-insurance/construction.html' },
      { title: 'Workers\' Compensation Laws, State by State Comparison', publisher: 'NFIB', url: 'https://www.nfib.com/content/toolkit/legal/workers-compensation-laws/', date: '2017' },
    ],
  },
  {
    name: 'Texas', code: 'TX',
    wc: {
      at: 'Optional (required on public projects)',
      short: 'Texas private employers can choose whether to carry workers\' comp. Employers without it (non-subscribers) must tell their employees and file a notice with the state.',
      detail: 'On building and construction projects for a government entity, every contractor has to carry workers\' comp for its people on the project.',
      agency: ['Texas Department of Insurance, Division of Workers\' Compensation', 'https://www.tdi.texas.gov/wc/nonsubscriber.html'],
    },
    lic: noStateMinimum('Texas has no statewide general contractor license.'),
    ai: {
      cite: 'Tex. Ins. Code ch. 151',
      at: 'Own negligence, with exceptions',
      kind: 'custom',
      text: 'Texas Insurance Code chapter 151 voids construction clauses that make a contractor indemnify another party for that party\'s own negligence, with exceptions that include claims for injury to the contractor\'s own employees. It also voids additional insured requirements that would give the other party coverage it couldn\'t get through indemnity.',
      insure: 'yes',
    },
    notes: [{ h: 'Government construction projects run on certificates of coverage', p: 'Texas Labor Code § 406.096 and 28 Tex. Admin. Code § 110.110 require each contractor on a public building or construction project to give the government entity a certificate of workers\' comp coverage before starting work, collect one from every company working under it before that company starts, pass along renewals, and post a coverage notice at the site. A contractor\'s non-subscriber status doesn\'t carry over to these jobs.' }],
    sources: [
      { title: 'Non-subscribers', publisher: 'Texas Department of Insurance', url: 'https://www.tdi.texas.gov/wc/nonsubscriber.html' },
      { title: 'Tex. Labor Code § 406.096', publisher: 'Public.Law', url: 'https://texas.public.law/statutes/tex._labor_code_section_406.096' },
      { title: '28 Tex. Admin. Code § 110.110', publisher: 'Legal Information Institute', url: 'https://law.cornell.edu/regulations/texas/28-Tex-Admin-Code-SS-110-110' },
    ],
  },
  {
    name: 'Utah', code: 'UT',
    wc: {
      at: '1 employee',
      short: 'With a few exceptions, every Utah employer must carry workers\' comp for all its employees.',
      agency: ['Utah Labor Commission, Industrial Accidents Division', 'https://laborcommission.utah.gov/divisions/industrial-accidents/employers/employers-guide-to-workers-compensation/'],
    },
    lic: {
      at: '$100K/$300K (increase pending)',
      short: 'Utah\'s Division of Professional Licensing (DOPL) requires licensed contractors to keep general liability in force, naming DOPL as certificate holder. The published rule sets $100,000 per incident and $300,000 total.',
      detail: 'DOPL proposed a rule in February 2026 (filing 57745) that would raise the minimum to $1,000,000 per incident and $3,000,000 total. Broker reports since then cite $1,000,000 and $2,000,000, while DOPL\'s own instructions still show $100,000 and $300,000. Until the final rule is published, confirm the amount in force with DOPL.',
    },
    ai: {
      cite: 'Utah Code Ann. § 13-8-1', at: 'The other party\'s fault',
      kind: 'custom',
      text: 'Utah Code § 13-8-1 voids construction contract clauses that require a contractor to insure, indemnify or defend another party against liability caused by that party\'s fault. When the owner shares fault, its share is apportioned rather than shifted. Some summaries describe Utah\'s rule as reaching only sole negligence, so have an attorney read the clause.',
      insure: 'yes',
    },
    sources: [
      { title: 'Employer\'s guide to workers\' compensation', publisher: 'Utah Labor Commission', url: 'https://laborcommission.utah.gov/divisions/industrial-accidents/employers/employers-guide-to-workers-compensation/' },
      { title: 'Utah Code § 13-8-1', publisher: 'Utah Legislature', url: 'https://le.utah.gov/xcode/Title13/Chapter8/C13-8-S1_1800010118000101.html' },
      { title: 'Utah Admin. Code R156-55a-302d, Proof of insurance', publisher: 'Legal Information Institute', url: 'https://www.law.cornell.edu/regulations/utah/Utah-Admin-Code-R156-55a-302d' },
      { title: 'General liability insurance requirements instructions', publisher: 'Utah Division of Professional Licensing', url: 'https://dopl.utah.gov/wp-content/uploads/2025/10/general-liability-insurance-requirements-instructions.pdf', date: '2025' },
      { title: 'Utah State Bulletin, Feb. 15, 2026 (R156-55a proposed rule, filing 57745)', publisher: 'Utah Office of Administrative Rules', url: 'https://rules.utah.gov/wp-content/uploads/b20260215.pdf', date: 'Feb 2026' },
      { title: 'Utah DOPL contractor liability insurance: $1M / $2M (April 2026)', publisher: 'GRIT Insurance', url: 'https://gritinsurance.com/blog/utah-dopl-contractor-liability-insurance-1m-2m-april-2026', date: '2026' },
    ],
  },
  {
    name: 'Vermont', code: 'VT',
    wc: {
      at: '1 employee',
      short: 'Vermont businesses with one or more employees must carry workers\' comp, with a few exceptions.',
      detail: 'Up to four corporate officers or LLC members can be excluded, with prior approval from the Department of Labor.',
      agency: ['Vermont Department of Labor', 'https://labor.vermont.gov/workers-compensation'],
    },
    lic: noStateMinimum(),
    ai: { cite: 'no statute; see Tateosian v. State, 945 A.2d 833 (Vt. 2007)', kind: 'none' },
    sources: [{ title: 'Application to exclude corporate officers or LLC members (Form 29)', publisher: 'Vermont Department of Labor', url: 'https://labor.vermont.gov/sites/labor/files/doc_library/Form29FillIn_0.pdf' }],
  },
  {
    name: 'Virginia', code: 'VA',
    wc: {
      at: '3 employees (counting those working under you)',
      short: 'Virginia businesses that regularly employ more than two people must carry workers\' comp.',
      detail: 'A contractor counts the employees of the companies working under it toward that number, whether or not those companies have their own coverage.',
      agency: ['Virginia Workers\' Compensation Commission', 'https://workcomp.virginia.gov/content/employers'],
    },
    lic: noStateMinimum('Virginia\'s contractor license has financial requirements but no liability insurance minimum we could find.'),
    ai: { cite: 'Va. Code Ann. §§ 11-4.1, 11-4.4', kind: 'sole' },
    sources: [
      { title: 'Employers', publisher: 'Virginia Workers\' Compensation Commission', url: 'https://workcomp.virginia.gov/content/employers' },
      { title: 'Va. Code Ann. § 11-4.1', publisher: 'Virginia General Assembly', url: 'https://law.lis.virginia.gov/vacode/title11/chapter1/section11-4.1/' },
    ],
  },
  {
    name: 'Washington', code: 'WA',
    wc: {
      at: '1 employee (state fund)',
      short: 'Any Washington business with employees must have workers\' comp through the state fund run by Labor & Industries (L&I), unless approved to self-insure. Private carriers can\'t write it.',
      agency: ['Washington Department of Labor & Industries', 'https://lni.wa.gov/insurance/insurance-requirements/do-i-need-a-workers-comp-account/'],
      mono: true,
    },
    lic: {
      at: '$200K + $50K PD, or $250K CSL',
      short: 'Washington contractor registration requires $200,000 in public liability and $50,000 in property damage, or a $250,000 combined single limit, plus a bond of $30,000 for general contractors or $15,000 for specialty contractors.',
    },
    ai: { cite: 'Wash. Rev. Code § 4.24.115', at: 'Sole negligence; shared fault limited', kind: 'custom', text: 'Washington\'s statute (RCW 4.24.115) voids construction clauses that make a contractor indemnify another party for that party\'s sole negligence. Where both share fault, indemnity is valid only to the extent of the contractor\'s own negligence.' },
    sources: [
      { title: 'Do I need a workers\' comp account?', publisher: 'Washington Department of Labor & Industries', url: 'https://lni.wa.gov/insurance/insurance-requirements/do-i-need-a-workers-comp-account/' },
      { title: 'Register as a contractor', publisher: 'Washington Department of Labor & Industries', url: 'https://lni.wa.gov/licensing-permits/contractors/register-as-a-contractor/index' },
      SHARED.stopgap,
      { title: 'Wash. Rev. Code § 4.24.115', publisher: 'Washington State Legislature', url: 'https://app.leg.wa.gov/RCW/default.aspx?cite=4.24.115' },
    ],
  },
  {
    name: 'West Virginia', code: 'WV',
    wc: {
      at: 'All employers',
      short: 'All West Virginia employers are required by law to carry workers\' comp. The Offices of the Insurance Commissioner reviews applications for exemption.',
      agency: ['West Virginia Offices of the Insurance Commissioner', 'https://www.wvinsurance.gov/Employer-Coverage'],
    },
    lic: noStateMinimum(),
    ai: { cite: 'W. Va. Code § 55-8-14', kind: 'sole' },
    sources: [
      { title: 'Employer coverage', publisher: 'West Virginia Offices of the Insurance Commissioner', url: 'https://www.wvinsurance.gov/Employer-Coverage' },
      { title: 'W. Va. Code § 55-8-14', publisher: 'West Virginia Legislature', url: 'https://code.wvlegislature.gov/55-8-14/' },
    ],
  },
  {
    name: 'Wisconsin', code: 'WI',
    wc: {
      at: '3 employees, or $500 a quarter',
      short: 'Wisconsin employers must carry workers\' comp once they have three or more full-time or part-time employees, or pay $500 or more in wages in any calendar quarter.',
      agency: ['Wisconsin Worker\'s Compensation Division', 'https://www.dwd.wisconsin.gov/wc/employers/'],
    },
    lic: {
      at: '$250K (dwelling contractors)',
      short: 'Wisconsin dwelling contractors must show general liability of at least $250,000 per occurrence (or a bond in its place), plus workers\' comp and unemployment insurance where they apply.',
    },
    ai: { cite: 'Wis. Stat. § 895.447', kind: 'broad' },
    sources: [
      { title: 'Employers', publisher: 'Wisconsin Department of Workforce Development', url: 'https://www.dwd.wisconsin.gov/wc/employers/' },
      { title: 'Wisconsin Statutes, dwelling contractor financial responsibility', publisher: 'Wisconsin Legislature', url: 'https://docs.legis.wisconsin.gov/document/statutes/101.66' },
    ],
  },
  {
    name: 'Wyoming', code: 'WY',
    wc: {
      at: 'Required work (state fund)',
      short: 'Wyoming employers in the occupations its Workers\' Compensation Act requires to be covered must buy coverage from the state fund and get a statement of coverage before starting work. They can\'t self-insure.',
      detail: 'Employers outside the required occupations can choose coverage, and some can buy it from a private carrier. Check that a contractor\'s work falls under the state fund before accepting anything else.',
      agency: ['Wyoming Department of Workforce Services', 'https://dws.wyo.gov/dws-division/workers-compensation/new-employers/'],
      mono: true,
    },
    lic: noStateMinimum('Wyoming has no statewide general contractor license.'),
    ai: { cite: 'no general statute; see United Pacific Resources Co. v. Dolenc, 86 P.3d 1287 (Wyo. 2004)', kind: 'none' },
    sources: [
      { title: 'New employers', publisher: 'Wyoming Department of Workforce Services', url: 'https://dws.wyo.gov/dws-division/workers-compensation/new-employers/' },
      { title: 'Workers\' compensation presentation to the Joint Appropriations Committee', publisher: 'Wyoming Department of Workforce Services', url: 'https://wyoleg.gov/InterimCommittee/2023/02-2023071010-04_WorkersCompensation_JAC_Final.pdf', date: '2023' },
      SHARED.stopgap,
    ],
  },
];

for (const s of STATES) s.slug = s.slug || s.name.toLowerCase().replace(/[^a-z]+/g, '-');

module.exports = { REVIEWED, SHARED, STATES };
