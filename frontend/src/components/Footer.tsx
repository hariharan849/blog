import { BLOGS } from "@/lib/format";

export default function Footer() {
  return (
    <footer className="site-footer text-center py-3 mt-auto">
      {Object.values(BLOGS).map((blog) => (
        <p key={blog.author} className="mb-1">
          {blog.author}:
          {Object.entries(blog.links).map(([label, href]) => (
            <a key={label} href={href} target="_blank" rel="noopener noreferrer">{label}</a>
          ))}
        </p>
      ))}
      <small>&copy; {new Date().getFullYear()} PyChanter</small>
    </footer>
  );
}
