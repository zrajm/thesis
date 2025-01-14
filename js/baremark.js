(w=>{
	let l,s=x=>x.replace(/\s+/,' ').trim(),e=x=>x.replace(/[&'\\#<>`*~_=:"![\]()\n\t-]/g,m=>`&#${m.charCodeAt(0)};`),r=[
		[/\r\n?/g,'\n'],
		[/\n+```\n(.*?)\n```\n*(?=\n)/gs,(_,m)=>`\n\n<pre>${e(m)}</pre>\n`],
		[/([^\\])(?<!\\)(`+)(\n?(.+\n)*?.*?([^`\n\\]|.\n))\2(?!`)/g,(_,p,m,n)=>p+`<tt>${e(n.replace(/^(\s)(.*)\1$/,'$2'))}</tt>`],
		[/\\[\x21-\x2f:;<=>?@[\\\]^_`{|}~\n]/g,m=>m=='\\\n'?'<br>':`&#${m.charCodeAt(1)};`],
		[/\n\[(\n?.+?(\n.+?)*?\n?)\]: +(?:< *([^>]*) *>|(\S+))(?: +(?:'([^']*)'|"([^"]*)"|\(([^)]*)\)|(\S+)))?(?=\n)/g,($,n,_,a,b,c,d,e,f)=>(l[s(n)]=[a||b,c||d||e||f],'')],
		[/\n\n([-_*]) *(\1 *){2,}(?=\n\n)/g,'\n\n<hr>'],
		[/\n\n(#{1,6}) +(\S.*?)( +#+)?(?=\n\n)/g,(_,i,n)=>`\n\n<h${i=i.length}>${n}</h${i}>`],
		[/\n(.+?(?:\n.+?)*?)\n(?:(=+)|-+)(?=\n)/g,(_,x,i)=>`\n<h${i=i?1:2}>${x}</h${i}>\n`],
		[/\n> *(.*)/g,'\n\n<blockquote>\n\n$1\n\n</blockquote>\n'],
		[/\n\n<\/(blockquote)>\n\n\n<\1>\n\n/g,'\n'],
		[/\n[-+*] +(.+(\n .+)*)/g,'\n\n<ul><li>$1</li></ul>\n'],
		[/\n\d+[.)] +(.+(\n .+)*)/g,'\n\n<ol><li>$1</li></ol>\n'],
		[/<\/(ol|ul)>\n\n\n<\1>/g,''],
		[/___(\n?(.+\n)*?.*?)___/g,'<u>$1</u>'],
		[/(\*\*|__)(\n?(.+\n)*?.*?)\1/g,'<b>$2</b>'],
		[/([*_])(?!\1)(\n?(.+\n)*?.*?)\1/g,'<i>$2</i>'],
		[/~~(\n?(.+\n)*?.*?)~~/g,'<s>$1</s>'],
		[/:"(\n?(.+\n)*?.*?)":/g,'<q>$1</q>'],
		[/!\[(\n?(.+\n)*?.*?)\]\( *\n? *([^\n ()]+) *\n? *\)/g,'<img src="$3" alt="$1">'],
		[/\[(\n?.+?(\n.+?)*?\n?)\]\( *\n? *([^\n ()]+) *\n? *\)/g,'<a href="$3">$1</a>'],
		[/\[(\n?.+?(\n.+?)*?\n?)\](?:\[(\n?.+?(\n.+?)*?\n?)\])?/g,(w,t,_,n)=>(n=s(n||t),l[n]?`<a href="${l[n][0]}" title="${l[n][1]||''}">${t}</a>`:w)],
		[/\n\n(.+(\n.+)*)(?=\n\n)/g,(w,m)=>/^<(\/|address|article|aside|blockquote|details|div|[dou]l|fieldset|fig(caption|ure)|footer|form|h\d|header|hgroup|hr|main|menu|nav|p|pre|(no)?script|search|section|style|table)\b/.test(m)?w:`\n\n<p>${m}</p>`]]
	w.baremark=x=>x===undefined?r:(l={},r.reduce((a,r)=>a.replace(...r),`\n\n${x}\n\n`).trim())
	w.baremark.escape=e
})(self)
