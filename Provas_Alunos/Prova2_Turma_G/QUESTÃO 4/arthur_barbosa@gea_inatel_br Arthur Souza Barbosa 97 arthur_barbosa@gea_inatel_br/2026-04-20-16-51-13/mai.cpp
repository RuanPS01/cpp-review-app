#include <iostream>
using namespace std;

int main()
{
    int v[100], x, cont=0;
    cin >> v[100], x;
    while(v[100]!=0)
    {
        cont ++;
        
        
    }
    for(int i=0; i<cont; i++)
    {
        cin>> v[i];
        if(x=i)
        {
            cout << x << "encontrado na posicao " << i << endl;
        }
        else if(x!=i)
        {
            cout << "Elemento nao encontrado" << endl;
        }
        
    }
    
    return 0;
}