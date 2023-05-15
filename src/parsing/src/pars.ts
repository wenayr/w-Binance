import axios from "axios";
import * as fs from "fs";
import * as stream from "stream";

console.log("123123213")
console.log("123123213")
console.log("123123213")


const API_KEY = 'xxx';
const API_SECRET = 'yyy';

// Возвращает подстроку между первыми найденными элементами
function getSubStringElBy(st: string, el1_?: string, el2_?: string) {
    const [el1,el2] = [el1_ ?? ">", el2_ ?? el1_ ?? "<"]

    const t1 = st.indexOf(el1) + el1.length
    return st.substring(t1 , st.indexOf(el2, t1))
}


function getTab(num: number) {
    let t = ""
    for (let i = 0; i < num; i++) t+="\t"
    return t
}

// парсим входящие параметры
function FParsingInputParameters(arrData: string[]) {

    type tStatus = 0|1|2|3
    type tArrParam = string[]

    const getDefault = () => ({
        arrParams: <tArrParam[]>[],
        arrTitle: <string[]>[]
        })

    const getBuffer = () => ({
        index: 0,
        nums: -2,
        max: 0,
        status: <tStatus>0
    })

    let data: ReturnType<typeof getDefault> = getDefault()
    let buffer: ReturnType<typeof getBuffer> = getBuffer()


    function func(st: string) {
        if (buffer.status == 0) {

            if (st.indexOf("Parameters") >= 0) {
                data = getDefault()
                buffer = {...getBuffer(), status: 1}
            }
            
            return undefined;
        }

        if (buffer.status != 1) return;
        if (st.indexOf("</table>") >= 0) {
            const buf = data
            data = getDefault()
            buffer = getBuffer()
            return buf;
        }
        // <code>
        if (st.indexOf("<tr>") >= 0) {
            buffer.nums++
            buffer.index = 0;

        }

        if (buffer.nums == -1) {
            if (st.indexOf("<th>") >= 0) {
                data.arrTitle[buffer.max] = getSubStringElBy(st,"<th>","</th>")
                buffer.max++
            }
        }

        if (buffer.nums < 0) return undefined;

        if (st.indexOf("<td>") >= 0) {
            // if (paramObj.index >= paramObj.max - 1) paramObj.index =0;
            const sub = getSubStringElBy(st,">","<" )
            const a = data.arrParams[buffer.nums] = data.arrParams[buffer.nums] ?? []
            a[buffer.index] = sub
            buffer.index++
        }
        return undefined;
    }
    return func
}


function fParsingName() {

    // имя
    const func = function (st: string){
        const tr = st.indexOf('<h2')
        if (tr == -1) return undefined

        const b = getSubStringElBy(st.substring(tr+3))
        const dop = b.indexOf("(")
        const name = dop>=0 ? b.substring(0,dop)  : b
        return {
            name: name,
            type: dop>=0 ? getSubStringElBy(b, "(",")") : "",
            www: getSubStringElBy(st, "id='","'")
        }
    }
    return func
}

function fParsingWight(arrData: string[]) {
    const getDefault = () => (<{
        name: string,
        data: number
    }[]>[])

    const getBuffer = () => ({
        flag: false,
        st: ""
    })

    let data: ReturnType<typeof getDefault> = getDefault()
    let buffer: ReturnType<typeof getBuffer> = getBuffer()

    const func = function (st: string){
        if (buffer.flag == true) {
            buffer.st += st
            let sb = buffer.st.replaceAll("\n","")
            const ff = (s: string) => {
                let name = getSubStringElBy(s,"<strong>","</strong>")
                const bs = s.indexOf("</strong>")
                let type =  name
                const p1 = s.indexOf("(")
                if (p1) {
                    name = name.substring(0, p1)
                    type = getSubStringElBy(s,"(",")")
                }
                const buf = s.substring(bs + 5)
                const data = getSubStringElBy(buf,">","<")
                return {
                    name, type, data, buf
                }
            }

            let tt = sb

            let r =-1
            r = tt.indexOf("strong>Weight")
            if (r>=0) {
                const datum = ff(tt)
                tt = datum.buf

                data[0] = {name: `"` + datum.type + `"`, data: +datum.data.replaceAll(":","")}

                r = tt.indexOf("strong>Weight")
                if (r>=0) {
                    const datum2 = ff(tt)
                    data[1] = {name: `"` + datum2.type + `"`, data: +datum2.data.replaceAll(":","")}
                }
            }

            const buf = data
            data = getDefault()
            buffer = getBuffer()
            buffer.flag = false
            // arrData.push(`wightName: ${wightObj.name}\nwightData: ${wightObj.data ?? 0}\n`)
            return buf
        }

        const tw = st.indexOf("strong>Weight")
        if (tw >= 0) {
            buffer.flag = true
            buffer.st = st

            return undefined;
        }
        return undefined;
    }
    return func
}

// Парсинг ссылки
function fParsingUrl() {
    const getDefault = () => ({
        type: "",
        url: "",
        HMAC: false
    })

    const getBuffer = () => ({
        status: 0
    })

    let data: ReturnType<typeof getDefault> = getDefault()
    let buffer: ReturnType<typeof getBuffer> = getBuffer()

    const func = function (st: string){

        let string = st

        if (buffer.status == 0 && string == "<p><code>") {
            buffer.status = 1
            return undefined
        }

        if (buffer.status == 1 && string == "</code></p>") {
            const buf = data
            data = getDefault()
            buffer.status = 0
            return buf
        }

        {
            const sha = string.indexOf("(HMAC SHA256)")
            if (sha >= 0) {
                string = string.substring(0, sha)
                data.HMAC = true
            }
        }

        {
            const sha = string.indexOf(" ")
            if (sha >= 0) {
                const buf = string.substring(0, sha)

                const ff = (type: string) =>{
                    data.type = `"` + type + `"`
                    string = string.substring(type.length)
                }

                if (buf == "GET") ff(buf)
                else if (buf == "POST") ff(buf)
            }
        }
        data.url = `"` + string.replaceAll(" ","") + `"`
    }
    return func
}

function fParsingReq() {

    const func = function (){

    }
    return func
}

start();

async function start() {
    const url = "https://binance-docs.github.io/apidocs/spot/en"

    const req =await axios.get(url)
    const data = req.data as string

    const arr = data.split("\n")
    const arrData: string[] = []

    let res = 0

    let specSum = 0
    let lvlName = 0
    const tLvl = {
        st: 0,
        name: 1,
        zn: 2,
        data: 3,
        comments: 4,
        unknow: 5,
    }

    let lvlType = 0

    const ff =  (st: string, a: string[]) => {
        let find = 0
        const r: number[] = ['="s2"', '="mi"', '="p"', '="c1"', '="kc"', '="nl' , '="mf']
            .map(e=>st.indexOf(e))
            .filter(e=>e>0)
            .sort((a,b)=>a-b)

        const fist = r[0] +1
        if (fist) {
            const buf = st.substring(fist)
            let data = getSubStringElBy(buf)

            if (lvlType >= tLvl.st) {lvlType++}

            if (lvlType == 5 || lvlType == -1) {
                // ожидаем комментарий
                if (data.indexOf("//") > -1) {
                    data += "\n" //+ tab(specSum)
                    if (lvlType == 5) {
                        lvlType = 1
                    }

                    if (lvlType == -1) {
                        lvlType = -1
                    }

                } else {
                    // это не комментарий
                    a.push("\n") //+ \`(${data})`
                    if (lvlType == 5) {
                        lvlType = 1
                    }

                    if (lvlType == -1) {
                        lvlType = -1
                    }

                  //  data =  data // + tab(specSum) + data
                }
            }


            if (data == "{" || data == "[" || data == ":{" || data == ":[") {
                if (data == "{" || data == ":{" ) {
                    lvlName ++;
                    data =   data + "\n"
                    lvlType = 0// tLvl.name
                }
                if (data == "[" || data == ":[") {
                    lvlType = -1
                }
                specSum++
                // data=data +"\n" + tab(specSum)
                // data = "\n" + tab(specSum) + data
            } else
            if (data == "}" || data == "]" || data == "}," || data == "],") {
                lvlType = 0
                data = "\n" + getTab(specSum) + data
                specSum--
                data += "\n" //+ tab(specSum)
            } else
            if ((lvlType == 3 || lvlType == -1) && data != ",") {
                const kv1 = data.indexOf('"')
                // если это номер
                if (kv1 == -1) {
                    if (data == "true" || data == "false") {
                        data = " boolean , // " + data
                    }
                    else {
                        const comment = data.indexOf('//')
                        if (comment >= 0) {
                            data+="\n"
                        }
                        else data = " number , // " + data
                    }
                }
                // если это номер в ""
                if (kv1 >= 0) {
                    const kv2 = data.indexOf('"', kv1 + 1)
                    const sub = +data.substring(kv1 + 1, kv2)
                    if (isNaN(sub) || data == "") {
                        data = " string , // " + data
                    } else {
                        data = " NumberString , // " + data
                    }
                }
            }


            if (lvlType == 4 || data == ",") {
                // ожидаем знак
                // lvlType = 4
                if (data == ",") {
                      data = ""
                   // data = "\n" + tab(specSum)
                //    data = "\n"
                }
            }

            if (lvlType == 5) {
                // ожидаем комментарий


                // после комментария - точно новая строчка
             //   data += "\n" + tab(specSum)
            }


            //if (data == "," || data == "{" || data == "}" || data == "["  || data == "]" ){}
            a.push(data)


            ff(buf,a)
            if (lvlType > 0) {
                lvlType --
            }

        }
        else {
            if (lvlType > 0) {
                a.push("\n")
                lvlType=0
                // ожидаем комментарий


                // после комментария - точно новая строчка
                //   data += "\n" + tab(specSum)
            }
        }
    }

    const getNames = fParsingName()
    const getParams = FParsingInputParameters(arrData)
    const getWight = fParsingWight(arrData)
    const getAddress = fParsingUrl()

    let twFlag: boolean = false

    type tEl = {
        name?: ReturnType<typeof getNames>,
        wight?: ReturnType<typeof getWight>,
        params?: ReturnType<typeof getParams>,
        address?: ReturnType<typeof getAddress>,
        st?: string
    }
    const result: tEl[] = []

    let el: tEl = {}

    function newEl() {
        el = {}
        result.push(el)
    }
    for (const string of arr) {

        // имя
        {
            const name = getNames(string)
            if (name) {
                newEl()
                el.name = name
                continue;
            }
        }


        // вес
        {
            const wight = getWight(string)
            if (wight) {
                el.wight = wight
                continue;
            }
        }

        // входные параметры
        {
            const params = getParams(string)
            if (params) el.params = params

        }

        // address
        {
            const address = getAddress(string)
            if (address) {
                el.address = address
                continue;
            }
        }

            let at: string[] = []
            const lastSpecSum = specSum

            ff(string, at)

            if (at.length) {
                const r = at.join("")
                el.st ??= ""
                el.st += getTab(lastSpecSum) + at.join(" ") //+ "\n"
            }
    }


    // https://binance-docs.github.io/apidocs/pm/en/#cancel-cm-order-trade
    const str = result.map((e,i)=>{
        // &#39; &#39;
        const _name = e.name?.name.replaceAll("&#39;","")
        const _type = e.name?.type.replaceAll("&#39;","")
        const www = e.name?.www && `//${url+"#"+(e.name.www??"")}`
        const name = _name && `const name: "${(_name??"" )+ (_type? "("+_type+")" :"")}"`
        const nameType = e.name && `const nameType: "${(_type??"")}"`

        const nameFunc = _name ? _name
            .replaceAll(" ","")
            .replaceAll("(","")
            .replaceAll(")","")
            .replaceAll("/","")
            .replaceAll("-",""): "noname" + i


        let wight = `const wight: [`;
        (e.wight ?? []).forEach((e,i, ar)=>{

            const buf: string[] = []
            Object.entries(e).forEach(([key,v])=>{
                if (v) buf.push(key + " : " + v)
            })
            let p2 = buf.map((e,i,ar)=>ar[i]="\t\t"+e).join("\n")

            wight+="{\n"+p2+"\n\t}"
            if (i!=ar.length-1) wight += " ,\n\t";
            else wight += "\n";
        })
        wight+="]"



        let paramComment: string|undefined// = "// "
        if (e.params?.arrTitle.length) {
            paramComment = "//"
            const {arrTitle} = e.params
            for (let ps of arrTitle)  paramComment += " " + ps
        }

        let st = ""
        if (e.params?.arrParams.length) {
            st =  "type params = {\n"
            const {arrParams} = e.params
            for (const ps of arrParams) {
                if (ps[3]?.length) st+="\t// " + ps[3] +"\n"
                if (ps) st+=`\t${ ps[0] }${ ps[2] == "NO" ? "?" : "" } : ${ ps[1] }\n`
            }
            st+="}"
        }


        let url2 = ""
        if (e.address) {
            const address = e.address
            url2 = "const address : {\n"
            const buf: string[] = []
            Object.entries(address).forEach(([key,v])=>{
                if (v) buf.push(key + " : " + v)
            })
            url2 += buf.map((e,i,ar)=>ar[i]="\t"+e).join("\n")
            url2 +="\n}"
        }



        // const tr = (s?: string) => s?.length ? s + "\n" : ""
        function tr(s?: string) {
            return s?.length ? s + "\n" : ""
        }

        let bb =
            //tr(www)
            tr( name )
            + tr( nameType )
            + tr( wight )
            + tr( url2 )
            + tr( paramComment )
            + tr( st )
            + "type req = " + (e.st?? "{}")

        bb = "\t" + bb.replaceAll("\n","\n\t")

        return tr(www) + `\n${nameFunc} = () => {\n`
            + bb
            + `\n}\n\n`

    }).join("")




    const def = `type LONG = number
type NUMBER = number
type STRING = string
type INT = number
type DECIMAL = number
type INTEGER = number
type ARRAY<T = any> = T[]
type BigDecimal = number
type DOUBLE = number  
type BOOLEAN = boolean  


type NumberString = string\n\n
`

    const rq = `
class CBinance {
${str}
}    
`


    // = arrData.join("")
    /*<p><strong>Weight(UID):</strong> 1
<strong>Weight(IP):</strong> 1</p>*/

    fs.writeFileSync('proba745.ts', def+rq);

    console.log(req)
    // await req2.json()
    // console.log(req2)
    // const req= new XMLHttpRequest1;
    // req.open('GET',url);
    // //сохдаем масив элементов типа data[].symbol из полученных данных  и отправляе полученный масив в колбэк в виде string[]
    // req.onload=(data:any)=> console.log(data);
    // req.send();
}

