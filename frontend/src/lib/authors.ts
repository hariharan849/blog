/**
 * Static profile content for the "About me" pages.
 * `username` must match the Django username of the author so the
 * author filter (/?author=<username>) returns their posts.
 */
export type Profile = {
  username: string;
  name: string;
  shortName: string;
  role: string;
  /** Optional image in /public, e.g. "/images/profile.jpg". Initials are shown when unset. */
  avatar?: string;
  intro: string;
  expertise: string[];
  why: string;
  links: { label: string; href: string }[];
};

export const profiles: Profile[] = [
  {
    username: "hariharan",
    name: "Hariharan Manoharan",
    shortName: "Hariharan",
    role: "Senior Software Developer · VFX & Deep Learning",
    intro:
      "Hi, I'm Hariharan, a Senior Software Developer specializing in VFX and Deep Learning. With over 9 years of experience, I have worked on AI-powered tools, pipeline automation, and high-performance computing.",
    expertise: [
      "AI & Machine Learning",
      "VFX & Pipeline Development",
      "Python, Django, PyQt/PySide2",
      "Nuke, Silhouette, Unreal Engine",
    ],
    why: "This blog is my way of sharing knowledge on deep learning, AI integration in VFX, and best practices in software development.",
    links: [
      { label: "LinkedIn", href: "https://www.linkedin.com/in/hariharan-manoharan-6b059958/" },
      { label: "GitHub", href: "https://github.com/hariharan849" },
      { label: "Kaggle", href: "https://www.kaggle.com/hariharan849" },
    ],
  },
  {
    username: "rajan",
    name: "Rajan Singh",
    shortName: "Rajan",
    role: "Data Scientist · Machine Learning",
    intro:
      "Hi, I'm Rajan, a Data Scientist and Machine Learning Enthusiast. With a strong background in statistical modeling and computer vision, I've been developing AI solutions that transform complex data into meaningful insights.",
    expertise: [
      "Data Science & Analytics",
      "Machine Learning & Deep Learning",
      "Python, R, and TensorFlow",
      "Computer Vision and Natural Language Processing",
    ],
    why: "This blog is my platform for sharing the latest trends in AI, deep learning techniques, and best practices in data-driven decision making. Here, I break down complex concepts into actionable insights for fellow enthusiasts and professionals.",
    links: [
      { label: "LinkedIn", href: "https://www.linkedin.com/in/rajan-singh-parmar-3698891b1/" },
      { label: "GitHub", href: "https://github.com/rajanpratap" },
      { label: "Kaggle", href: "https://www.kaggle.com/rajansinghparmar" },
    ],
  },
];

export function getProfile(username: string | undefined) {
  if (!username) return undefined;
  return profiles.find((p) => p.username.toLowerCase() === username.toLowerCase());
}
