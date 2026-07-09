export interface Faculty {
  id: string;
  name: string;
  shortName?: string;
  description: string;
  departments: string[];
}

export const faculties: Faculty[] = [
  {
    id: "science",
    name: "Faculty of Science",
    description: "Foundational science programs across computing, natural sciences, and research disciplines.",
    departments: [
      "Biology",
      "Chemistry",
      "Computer Science",
      "Environmental Science",
      "Mathematics",
      "Physics",
    ],
  },
  {
    id: "social-sciences-humanities",
    name: "Faculty of Social Sciences and Humanities",
    shortName: "FSSH",
    description: "Humanities, social science, communication, business, culture, and public-facing disciplines.",
    departments: [
      "Geography",
      "History",
      "International Business Management",
      "Khmer Literature",
      "Linguistics",
      "Media and Communication",
      "Philosophy",
      "Psychology",
      "Sociology",
      "Social Work",
      "Tourism",
    ],
  },
  {
    id: "engineering",
    name: "Faculty of Engineering",
    description: "Modern engineering programs focused on systems, data, environment, bioengineering, and technology.",
    departments: [
      "Automation and Supply Chain Systems Engineering",
      "Bioengineering",
      "Data Science Engineering",
      "Environmental Engineering",
      "Information Technology Engineering",
      "Telecommunication and Electronic Engineering",
    ],
  },
  {
    id: "development-studies",
    name: "Faculty of Development Studies",
    description: "Programs focused on community, economic, natural resources, and sustainable development.",
    departments: [
      "Community Development",
      "Economic Development",
      "Natural Resources Management and Development",
    ],
  },
  {
    id: "education",
    name: "Faculty of Education",
    description: "Education programs supporting teaching, higher education leadership, and lifelong learning.",
    departments: [
      "Educational Studies",
      "Higher Education Development and Management",
      "Lifelong Learning",
    ],
  },
  {
    id: "ifl",
    name: "Institute of Foreign Languages",
    shortName: "IFL",
    description: "Language programs connecting students with regional and international communication pathways.",
    departments: ["Chinese", "English", "French", "Japanese", "Korean", "Thai"],
  },
  {
    id: "iispp",
    name: "Institute of International Studies and Public Policy",
    shortName: "IISPP",
    description: "International relations, economics, public policy, and regional studies programs.",
    departments: [
      "International Relations",
      "International Economics",
      "Political Science and Public Policy",
      "Vietnamese Studies",
    ],
  },
  {
    id: "research-centers",
    name: "Research Centers / Institutes",
    description: "Research centers supporting Cambodian, regional, maritime, and silk research initiatives.",
    departments: [
      "Centre for South East Asian Studies",
      "Centre for Cambodian Studies",
      "Cambodia 21st Century Maritime Silk Road Research Centre",
      "Silk Research Centre",
    ],
  },
];

export const getFacultyById = (id: string | undefined) =>
  faculties.find((faculty) => faculty.id === id);
