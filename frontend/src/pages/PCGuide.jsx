import "../styles/PCGuide.css";

export default function PCGuide() {
  const sections = [
    {
      title: "CPU",
      subtitle: "The Brain of the System",
      description:
        "Your CPU handles calculations, multitasking, gaming logic, streaming, and productivity workloads. A balanced CPU prevents performance bottlenecks.",
      points: [
        "Higher clock speeds help gaming",
        "More cores improve multitasking",
        "Avoid pairing weak CPUs with powerful GPUs",
      ],
    },
    {
      title: "GPU",
      subtitle: "Gaming & Graphics Performance",
      description:
        "The graphics card determines gaming performance, visual quality, rendering speed, and resolution capabilities.",
      points: [
        "Match GPU power to your monitor resolution",
        "More VRAM helps modern games",
        "Strong GPUs matter most for gaming builds",
      ],
    },
    {
      title: "RAM",
      subtitle: "System Memory",
      description:
        "RAM helps your PC manage multiple applications and large workloads without slowing down.",
      points: [
        "16GB is a strong baseline",
        "32GB helps content creation and streaming",
        "Faster RAM can improve responsiveness",
      ],
    },
    {
      title: "Storage",
      subtitle: "Speed & Capacity",
      description:
        "Fast storage improves boot times, loading screens, and overall responsiveness.",
      points: [
        "NVMe SSDs offer the fastest speeds",
        "SSDs are much faster than HDDs",
        "Use HDDs for cheaper mass storage",
      ],
    },
    {
      title: "Cooling",
      subtitle: "Temperature & Stability",
      description:
        "Good airflow and cooling keep your components stable and extend hardware lifespan.",
      points: [
        "Airflow matters more than RGB",
        "Better cooling improves sustained performance",
        "Dust cleanup helps temperatures over time",
      ],
    },
    {
      title: "Power Supply",
      subtitle: "System Reliability",
      description:
        "A reliable PSU safely powers every component in your PC and protects your hardware.",
      points: [
        "Use trusted PSU brands",
        "80+ Bronze or Gold recommended",
        "Leave wattage room for upgrades",
      ],
    },
  ];

  return (
    <div className="pcguide-page">
      <div className="pcguide-container">
        <section className="pcguide-hero">
          <span className="pcguide-badge">PC Build Education</span>

          <h1 className="pcguide-title">WHAT MAKES A GOOD PC?</h1>

          <p className="pcguide-description">
            A great PC is not just about expensive parts. The best systems are
            balanced, reliable, optimized for the user’s needs, and designed
            with future upgrades in mind.
          </p>
        </section>

        <section className="pcguide-grid">
          {sections.map((section) => (
            <article key={section.title} className="pcguide-card">
              <h2>{section.title}</h2>
              <p className="pcguide-subtitle">{section.subtitle}</p>
              <p className="pcguide-card-description">{section.description}</p>

              <div className="pcguide-points">
                {section.points.map((point) => (
                  <div key={point} className="pcguide-point">
                    <span className="pcguide-dot" />
                    <p>{point}</p>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>

        <section className="pcguide-final">
          <h2>FINAL BUILD ADVICE</h2>

          <p>
            The best PC builds are balanced for the user’s goals and budget.
            Overspending on one component while neglecting another can reduce
            overall performance.
          </p>

          <p>
            Reliability, airflow, compatibility, and upgrade potential are just
            as important as raw power.
          </p>

          <p>
            A smart build focuses on long-term usability, stable performance,
            and a smooth experience for gaming, school, work, or content
            creation.
          </p>
        </section>
      </div>
    </div>
  );
}