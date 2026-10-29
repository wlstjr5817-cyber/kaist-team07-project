import React from 'react';
import Feather from '@expo/vector-icons/Feather';
export default function Icon({name,size=21,color='#172C20'}:{name:any;size?:number;color?:string}){return <Feather name={name} size={size} color={color}/>;}
