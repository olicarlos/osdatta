export interface Periodo {inicio:string;fim:string}
export interface Servico {os:string;osc:string;peso:number}
export interface Dia {sit:string;e?:string;s?:string;as?:string;av?:string;sv:Servico[];periodos_ociosos?:Periodo[];ok?:boolean;confirmacao?:unknown;[key:string]:unknown}
export const FERIADOS:string[];
export const JORNADA:number;
export function minutos(t:unknown):number|null;
export function dataValida(d:unknown):boolean;
export function especial(d:string):boolean;
export function clone<T>(x:T):T;
export function assinatura(d:unknown):string;
export function confirmar(d:unknown):Dia;
export function aprovado(d:unknown):boolean;
export function periodos(d:unknown):Periodo[];
export function canonicalDay(d:unknown):Dia;
export function validateDay(d:unknown):string[];
export function calcDay(d:unknown,dt:string):{bruto:number;almoco:number;ocioso:number;descontado:number;tot:number;n:number;h50:number;h100:number};
