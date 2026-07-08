// -------------------- Theme --------------------
const themeBtn = document.getElementById("themeBtn");

themeBtn.addEventListener("click", () => {
    document.body.classList.toggle("light");

    if(document.body.classList.contains("light")){
        themeBtn.textContent="🌞";
        localStorage.setItem("theme","light");
    }else{
        themeBtn.textContent="🌙";
        localStorage.setItem("theme","dark");
    }
});

if(localStorage.getItem("theme")==="light"){
    document.body.classList.add("light");
    themeBtn.textContent="🌞";
}

// -------------------- JSON Formatter --------------------
function formatJSON(){

    const input=document.getElementById("jsonInput");

    try{

        const obj=JSON.parse(input.value);

        input.value=JSON.stringify(obj,null,4);

    }catch{

        alert("Invalid JSON");

    }

}

function copyJSON(){

    navigator.clipboard.writeText(
        document.getElementById("jsonInput").value
    );

}

// -------------------- Password Generator --------------------

function generatePassword(){

    const length=parseInt(
        document.getElementById("length").value
    );

    const chars="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=";

    let pass="";

    for(let i=0;i<length;i++){

        pass+=chars.charAt(
            Math.floor(Math.random()*chars.length)
        );

    }

    document.getElementById("passwordResult").value=pass;

}

function copyPassword(){

navigator.clipboard.writeText(
document.getElementById("passwordResult").value
);

}

// -------------------- UUID --------------------

function generateUUID(){

const uuid=crypto.randomUUID();

document.getElementById("uuidResult").value=uuid;

}

function copyUUID(){

navigator.clipboard.writeText(
document.getElementById("uuidResult").value
);

}

// -------------------- Base64 --------------------

function encodeBase64(){

const txt=document.getElementById("baseInput").value;

document.getElementById("baseOutput").value=btoa(txt);

}

function decodeBase64(){

const txt=document.getElementById("baseInput").value;

try{

document.getElementById("baseOutput").value=atob(txt);

}catch{

alert("Invalid Base64");

}

}

// -------------------- Word Counter --------------------

const wordInput=document.getElementById("wordInput");

wordInput.addEventListener("input",()=>{

const text=wordInput.value.trim();

const count=text===""?0:text.split(/\s+/).length;

document.getElementById("wordCount").innerHTML="Words : "+count;

});
