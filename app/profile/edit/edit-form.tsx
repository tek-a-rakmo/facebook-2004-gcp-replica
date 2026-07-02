"use client";

import type { User } from "@prisma/client";
import { updateProfile } from "@/lib/actions";
import PhotoUpload from "./photo-upload";

const TEXT_FIELDS: { name: keyof User & string; label: string }[] = [
  { name: "concentration", label: "Concentration" },
  { name: "hometown", label: "Hometown" },
  { name: "highSchool", label: "High School" },
  { name: "residence", label: "Residence" },
  { name: "birthday", label: "Birthday" },
  { name: "relationshipStatus", label: "Relationship Status" },
  { name: "interestedIn", label: "Interested In" },
  { name: "lookingFor", label: "Looking For" },
  { name: "favoriteBooks", label: "Favorite Books" },
  { name: "favoriteMusic", label: "Favorite Music" },
  { name: "favoriteMovies", label: "Favorite Movies" },
  { name: "courses", label: "Courses" },
];

export default function EditForm({ user }: { user: User }) {
  return (
    <form action={updateProfile}>
      <div className="tf-box">
        <div className="tf-box-title">Basics</div>
        <div className="tf-box-body">
          <label htmlFor="name">Name</label>
          <input
            id="name"
            type="text"
            name="name"
            defaultValue={user.name}
          />

          <PhotoUpload defaultUrl={user.photoUrl ?? undefined} />
        </div>
      </div>

      <div className="tf-box">
        <div className="tf-box-title">Profile</div>
        <div className="tf-box-body">
          {TEXT_FIELDS.map((f) => (
            <div key={f.name}>
              <label htmlFor={f.name}>{f.label}</label>
              <input
                id={f.name}
                type="text"
                name={f.name}
                defaultValue={(user[f.name] as string | null) ?? ""}
              />
            </div>
          ))}

          <label htmlFor="aboutMe">About Me</label>
          <textarea
            id="aboutMe"
            name="aboutMe"
            defaultValue={user.aboutMe ?? ""}
          />
        </div>
      </div>

      <div className="tf-actions">
        <button type="submit">Save Changes</button>
      </div>
    </form>
  );
}
