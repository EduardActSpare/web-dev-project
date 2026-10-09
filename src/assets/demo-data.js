export const images = {
  talent: [
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=700&q=85",
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=700&q=85",
    "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=700&q=85",
    "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=700&q=85"
  ],
  work: [
    "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=85",
    "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=85",
    "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=900&q=85",
    "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=900&q=85",
    "https://images.unsplash.com/photo-1511818966892-d7d671e672a2?auto=format&fit=crop&w=900&q=85",
    "https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=900&q=85"
  ],
  rentals: [
    "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=900&q=85",
    "https://images.unsplash.com/photo-1502982720700-bfff97f2ecac?auto=format&fit=crop&w=900&q=85",
    "https://images.unsplash.com/photo-1519183071298-a2962be90b8e?auto=format&fit=crop&w=900&q=85",
    "https://images.unsplash.com/photo-1492619375914-88005aa9e8fb?auto=format&fit=crop&w=900&q=85"
  ],
  studios: [
    "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1100&q=85",
    "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1100&q=85"
  ]
};

export const people = [
  { name: "Priya Sharma", role: "UX/UI Designer", category: "Design", location: "London, UK", rate: "$85/hr", rating: "4.9", experience: "Senior", years: 8, availability: "Available now", image: images.talent[0], skills: ["Figma", "UX Research", "Prototyping", "Design Systems"], text: "Designing human-centered experiences that make complex things simple." },
  { name: "Marcus Bell", role: "Full Stack Developer", category: "Development", location: "Remote", rate: "$95/hr", rating: "4.8", experience: "Mid-level", years: 5, availability: "Available now", image: images.talent[1], skills: ["React", "Node.js", "TypeScript", "AWS"], text: "Building scalable products at the intersection of design and technology." },
  { name: "Elena Rodriguez", role: "Brand Strategist", category: "Marketing", location: "Barcelona, Spain", rate: "$75/hr", rating: "4.9", experience: "Senior", years: 9, availability: "Not available", image: images.talent[2], skills: ["Brand Strategy", "Content", "Creative Direction"], text: "Helping brands find their voice and turn ideas into impact." },
  { name: "Jordan Lee", role: "Creative Developer", category: "Creative", location: "New York, US", rate: "$110/hr", rating: "5.0", experience: "Entry level", years: 2, availability: "Available now", image: images.talent[3], skills: ["WebGL", "Creative Coding", "Three.js"], text: "Making digital experiences feel a little more human." }
];

export const jobs = [
  { title: "Senior Product Designer", company: "Airbnb", logo: "A", location: "Remote · US", type: "Full-time", category: "Design", salary: "$120K – $160K", salaryMin: 120, experience: "Senior", posted: "3 days ago", description: "Help shape the next generation of travel experiences. You'll work across product, brand and engineering to create simple, delightful solutions.", tags: ["Figma", "Design Systems", "User Research"] },
  { title: "Frontend Developer", company: "Notion", logo: "N", location: "Remote", type: "Full-time", category: "Development", salary: "$100K – $160K", salaryMin: 100, experience: "Mid level", posted: "5 days ago", description: "Build the tools that help millions think better. Join a collaborative team working on delightful, high-performance web experiences.", tags: ["React", "TypeScript", "Next.js"] },
  { title: "Brand Marketing Manager", company: "Spotify", logo: "S", location: "New York, NY", type: "Full-time", category: "Marketing", salary: "$110K – $150K", salaryMin: 110, experience: "Mid level", posted: "1 week ago", description: "Lead creative campaigns that connect people through music. Partner with global teams to tell stories that resonate.", tags: ["Brand Strategy", "Content", "Campaigns"] },
  { title: "Senior Video Editor", company: "Northstar Studio", logo: "N", location: "New York, NY (Hybrid)", type: "Contract", category: "Creative", salary: "$85,000 – $110,000", salaryMin: 85, experience: "Senior", posted: "2 days ago", description: "We're looking for a Senior Video Editor to help bring our brand stories to life. You'll work closely with our creative, brand, and marketing teams.", tags: ["Premiere Pro", "After Effects", "Storytelling"] },
  { title: "Data Scientist", company: "Stripe", logo: "S", location: "Remote", type: "Full-time", category: "Data & AI", salary: "$130K – $190K", salaryMin: 130, experience: "Senior", posted: "4 days ago", description: "Turn complex data into clear insights. Help build intelligent systems that power the internet economy.", tags: ["Python", "SQL", "Machine Learning"] }
];

export const projects = [
  { title: "Forma Brand Identity", by: "Elena Park", type: "Graphic Design", category: "Graphic Design", image: images.work[0], likes: "1.2k" },
  { title: "Frames of Belonging", by: "Daniel Kim", type: "Video", category: "Video", image: images.work[1], likes: "842" },
  { title: "Pure by Nature", by: "Aisha Rahman", type: "Photography", category: "Photography", image: images.work[2], likes: "1.1k" },
  { title: "Orbit: Product Dashboard", by: "Jordan Ellis", type: "UI/UX", category: "UI/UX", image: images.work[3], likes: "275" },
  { title: "The Modern Line", by: "Priya Shah", type: "Photography", category: "Photography", image: images.work[4], likes: "689" },
  { title: "A quieter kind of living", by: "Studio Form", type: "Art Direction", category: "Branding", image: images.work[5], likes: "516" },
  { title: "A story in every frame", by: "Nadia Flores", type: "Social campaign", category: "SMM", image: images.work[1], likes: "394" },
  { title: "Good things grow", by: "North Studio", type: "Content campaign", category: "Content", image: images.work[2], likes: "628" },
  { title: "Field Notes", by: "Common Practice", type: "Web design", category: "Web Development", image: images.work[3], likes: "483" }
];

export const gear = [
  { name: "Sony FX6", type: "Cinema Camera", category: "Cameras", location: "London, UK", price: "$120", rating: "4.9", image: images.rentals[0], status: "Available today" },
  { name: "Canon EOS R5", type: "Mirrorless Camera", category: "Cameras", location: "Berlin, Germany", price: "$90", rating: "4.8", image: images.rentals[1], status: "Available today" },
  { name: "RED Komodo 6K", type: "Cinema Camera", category: "Cameras", location: "Los Angeles, USA", price: "$150", rating: "4.9", image: images.rentals[2], status: "Available tomorrow" },
  { name: "Blackmagic Pocket 6K", type: "Cinema Camera", category: "Cameras", location: "Toronto, Canada", price: "$80", rating: "4.7", image: images.rentals[3], status: "Available today" },
  { name: "Rode NTG5 Kit", type: "Shotgun Microphone", category: "Audio", location: "London, UK", price: "$35", rating: "4.9", image: images.rentals[2], status: "Available today" },
  { name: "Aputure 300D", type: "LED Light", category: "Lighting", location: "Berlin, Germany", price: "$55", rating: "4.8", image: images.rentals[0], status: "Available today" },
  { name: "Sigma 24-70mm", type: "Zoom Lens", category: "Lenses", location: "New York, USA", price: "$40", rating: "4.7", image: images.rentals[1], status: "Available tomorrow" }
];

export const studios = [
  { name: "The Lightroom", type: "Daylight photo studio", category: "Photo studios", location: "Brooklyn, New York", price: "$120", rating: "4.9", image: images.studios[0], status: "Available today" },
  { name: "Studio Common", type: "Creative production space", category: "Video studios", location: "London, UK", price: "$95", rating: "4.8", image: images.studios[1], status: "Available tomorrow" },
  { name: "Sound House", type: "Acoustically treated recording room", category: "Podcast rooms", location: "New York, USA", price: "$65", rating: "4.9", image: images.studios[0], status: "Available today" }
];
