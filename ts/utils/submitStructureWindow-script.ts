/// <reference path="../typescript_definitions/oxView.d.ts" />
/// <reference path="../typescript_definitions/index.d.ts" />

const apiRoot = "http://api.nanobase.org/api/v1";
interface LoginResponse {
  token: string;
}

async function login() {
  const emailField = document.getElementById(
    "email",
  ) as HTMLInputElement | null;
  const passwordField = document.getElementById(
    "password",
  ) as HTMLInputElement | null;
  const formData = {
    email: emailField.value,
    password: passwordField.value,
  };

  try {
    const response = await fetch(`${apiRoot}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formData),
    });

    if (response.ok) {
      const data = (await response.json()) as LoginResponse;
      localStorage.setItem("token", data.token);
      console.log("User authenticated. Token stored.");
      view.toggleWindow("loginwindow");
      view.toggleWindow("submitStructureWindow");
    } else {
      console.error("Authentication failed");
      alert("Authentication failed. Please check your credentials.");
    }
  } catch (error) {
    console.error("An error occurred:", error);
    alert("Something went wrong. Please try again later.");
  }
}

function uploadStructure(): void {
  const messageDiv = document.getElementById(
    "submitstructure-message",
  ) as HTMLElement;

  messageDiv.textContent = "";
  messageDiv.classList.remove(
    "submitstructure-success",
    "submitstructure-error",
  );

  const formData = new FormData();

  const titleInput = document.getElementById("title") as HTMLInputElement;
  const typeInput = document.getElementById("type") as HTMLInputElement;
  const descriptionInput = document.getElementById(
    "description",
  ) as HTMLTextAreaElement;
  const datePublishedInput = document.getElementById(
    "datePublished",
  ) as HTMLInputElement;
  const citationInput = document.getElementById("citation") as HTMLInputElement;
  const paperLinkInput = document.getElementById(
    "paperLink",
  ) as HTMLInputElement;
  const licensingInput = document.getElementById(
    "licensing",
  ) as HTMLInputElement;
  const privateInput = document.getElementById("private") as HTMLInputElement;
  const keywordsInput = document.getElementById("keywords") as HTMLInputElement;

  formData.append("title", titleInput.value);
  formData.append("type", typeInput.value);
  formData.append("description", descriptionInput.value);
  formData.append("datePublished", datePublishedInput.value);
  formData.append("citation", citationInput.value);
  formData.append("paperLink", paperLinkInput.value);
  formData.append("licensing", licensingInput.value);
  formData.append("private", privateInput.checked ? "true" : "false");

  const keywordsArray: string[] = keywordsInput.value
    .split(",")
    .map((kw) => kw.trim())
    .filter((kw) => kw !== "");
  keywordsArray.forEach((keyword) => {
    formData.append("keywords", keyword);
  });

  // Append images if any.
  const imagesInput = document.getElementById("images") as HTMLInputElement;
  if (imagesInput.files) {
    for (let i = 0; i < imagesInput.files.length; i++) {
      formData.append("images", imagesInput.files[i]);
    }
  }

  const submitStructureName = document.getElementById(
    "submitStructureName",
  ) as HTMLInputElement;
  formData.append("files", returnOxViewJsonFile(submitStructureName.value));

  const token = localStorage.getItem("token") || "";

  fetch(`${apiRoot}/structure/createStructure`, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      // Do not set 'Content-Type' header when using FormData.
    },
    body: formData,
  })
    .then(async (response): Promise<{ status: number; body: any }> => {
      const data = await response.json();
      return { status: response.status, body: data };
    })
    .then((result) => {
      if (result.status >= 200 && result.status < 300) {
        messageDiv.textContent =
          result.body.message || "Structure uploaded successfully!";
        messageDiv.classList.add("submitstructure-success");
      } else {
        messageDiv.textContent =
          result.body.message || "Failed to upload structure";
        messageDiv.classList.add("submitstructure-error");
      }
    })
    .catch((error) => {
      console.error("Error uploading structure:", error);
      messageDiv.textContent = "An error occurred while uploading.";
      messageDiv.classList.add("submitstructure-error");
    });
}

function returnOxViewJsonFile(name: string, space?: string | number): File {
  // Determine the file name
  const fileName =
    name && name.trim() !== "" ? `${name}.oxview` : "output.oxview";

  const content = JSON.stringify(
    {
      date: new Date(),
      box: box.toArray(),
      systems: systems,
      forces: forceHandler.forces,
      selections: selectionListHandler.serialize(),
    },
    null,
    space,
  );

  return new File([content], fileName, { type: "application/json" });
}

(window as any).login = login;
(window as any).uploadStructure = uploadStructure;
