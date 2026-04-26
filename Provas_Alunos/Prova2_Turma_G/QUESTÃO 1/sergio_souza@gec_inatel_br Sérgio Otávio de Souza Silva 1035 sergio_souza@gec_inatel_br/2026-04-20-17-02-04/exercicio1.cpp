#include<iostream>
using namespace std;

int main()
{
    int quantosNum;
    int n;
    int par ;
    int impar ;
    int positivo ;
    int negativo ;
    
    cin >> quantosNum;
    
    for(int i = 0;i < quantosNum;i++){
        cin >> n;
        if( n %2 == 0){
            n = par;
        }else if (n %2 != 0){
            n = impar;
        }else if(n > 0){
            n = positivo;
        }else if(n < 0){
            n = negativo;
        }
    }
    cout << par << " numeros pares" << endl;
    cout << impar << " numeros impares" << endl;
    cout << positivo << " numeros positivos" << endl;
    cout << negativo << " numeros negativos" << endl;
    return 0;
}