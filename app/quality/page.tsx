import HayLogo from "@/components/HayLogo";
import { runArmenianQualityBenchmark } from "@/lib/hay/quality-benchmark";

export const dynamic = "force-dynamic";

export default function QualityPage(){
  const report=runArmenianQualityBenchmark();
  const failed=report.results.filter(item=>!item.passed);
  return <main className="qualityPage">
    <header className="qualityNav">
      <a href="/"><HayLogo compact/></a>
      <nav><a href="/studio">Marketing OS</a><a href="/creator">Creator</a><a href="/voice">Voice</a><a className="active" href="/quality">Quality</a></nav>
      <span>HAY / LANGUAGE LAB</span>
    </header>

    <section className="qualityHero">
      <div><span className="qualityEyebrow">ARMENIAN QUALITY BENCHMARK / V1</span><h1><small>Չափել։</small>Ոչ թե ենթադրել։</h1><p>HAY-ը ամեն փոփոխությունից հետո նույն հայկական թեստերով ստուգում է խոսակցական լեզուն, բրենդների արտասանությունը, թվերը, արժույթները և code-switch-ը։</p></div>
      <div className={`qualityScore ${report.failedCases?"warning":"healthy"}`}><span>QUALITY SCORE</span><strong>{report.score}</strong><small>/ 100</small><i>{report.passedCases}/{report.cases} CASES</i></div>
    </section>

    <section className="qualityStats">
      <article><span>CASES</span><b>{report.cases}</b><small>curated regression scenarios</small></article>
      <article><span>ASSERTIONS</span><b>{report.assertions}</b><small>meaning + pronunciation checks</small></article>
      <article><span>PASSED</span><b>{report.passedAssertions}</b><small>deterministic checks</small></article>
      <article><span>FAILED</span><b>{report.failedCases}</b><small>must be zero before release</small></article>
    </section>

    <section className="qualityMatrix">
      <div className="qualitySectionHead"><span>01 / DOMAIN COVERAGE</span><h2>Հայերենը ստուգվում է իրական բիզնեսի կոնտեքստով։</h2></div>
      <div className="domainGrid">{Object.entries(report.byDomain).map(([domain,value])=><article key={domain}><span>{domain.toUpperCase()}</span><b>{value.passed}/{value.total}</b><div><i style={{width:`${value.total?Math.round((value.passed/value.total)*100):0}%`}}/></div></article>)}</div>
    </section>

    <section className="qualityMatrix">
      <div className="qualitySectionHead"><span>02 / REGRESSION CASES</span><h2>Natural Armenian + Speech normalization.</h2></div>
      <div className="qualityTable"><div className="qualityRow qualityHeader"><span>ID</span><span>DOMAIN</span><span>TYPE</span><span>OUTPUT</span><span>STATUS</span></div>{report.results.map(item=><div className="qualityRow" key={item.id}><span>{item.id}</span><span>{item.domain}</span><span>{item.kind}</span><span>{item.output}</span><span className={item.passed?"ok":"bad"}>{item.passed?"PASS":"FAIL"}</span></div>)}</div>
    </section>

    {failed.length>0&&<section className="qualityFailures"><span>03 / FAILURES</span>{failed.map(item=><article key={item.id}><b>{item.id}</b><p>{item.failures.join(" · ")}</p></article>)}</section>}

    <footer className="qualityFooter"><span>HAY ARMENIAN QUALITY LAYER</span><span>STANDARD · NATURAL · YEREVAN · SPEECH</span><a href="/voice">OPEN VOICE LAB ↗</a></footer>
  </main>;
}
