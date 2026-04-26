#include <iostream>

using namespace std ;

int main(){
    int i ; //contador do for 
    int n ; //ate n vezes 
    int valores ; //valores de entrada 
    int positivos=0 ; //para mostrar a quantidade de numeros positivos existem  
    int negativos=0; //para mostrar a quantidade de numeros neagtivos existem
    int par=0; //para mostrar a quantidade de numeros pares existem  
    int impar=0;//para mostrar a quantidade de numeros impares existem 
    
    
    //entrando com n 
    cin >> n ;
    for(i=0; i<n; i++){
        //entrando com valores
        cin >> valores ;
        //testando condicoes 
        if(valores>0 ){
            //contando quantos valores existem 
             positivos++; 
        }
        if(valores<0)
        {
            //contando quantos valores existem 
             negativos++; 
        }
        if(valores%2==0){
            //contando quantos valores existem 
            par++;
        }
        if(valores%2!=0)
        {
            //contando quantos valores existem 
            impar++;
        }
    }
  
    cout << par << " numeros pares" << endl ;
    cout << impar << " numeros impares" << endl ;
    cout << positivos << " numeros positivos" << endl ;
    cout << negativos << " numeros negativos" << endl ;
    
    return 0 ;
}