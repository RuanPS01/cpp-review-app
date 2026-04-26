#include <iostream>
using namespace std;


int main()
{
    float nums[100]; // Espero q 100 seja o suficiente xd
    
    int vecSize = 0;
    float a;
    
    cin >> a;
    while (a != 0)
    {
        nums[vecSize] = a;
        vecSize++;
        
        cin >> a;
    }
    
    float numToFind;
    cin >> numToFind;
    
    bool found = false;
    for (int i = 0; i < vecSize && !found; i++)
    {
        if (numToFind == nums[i])
        {
            found = true;
            cout << numToFind << " encontrado na posicao " << i << endl;
        
            // Toda vez q o numero q tá sendo procurado é "2.0" ou algo similar (x.0)
            // ele só imprime como "2" e isso sempre causa algum teste do moodle a falhar
            
            // Eu não posso só dar um setprecision pq o moodle espera a saida EXATAMENTE do jeito q foi entrada
            // no cin do numToFind, seja "n" ou "n.0"
            
            // Tipo, se o numero tiver virgula com algum valor quebrado diferente de zero ele funciona direitinho
            // mais por algum motivo o moodle espera a saida de algum float com 0 depois da virgula a ser
            // exatamente igual a como foi escrito na entrada, sendo q é literalmente só a mesma coisa que
            // um numero inteiro, então o c++ só imprime a parte inteira porque a parte float é zero
            
            // Eu GENUINAMENTE não fasso ideia de como consertar isso
            // Apologies in advance.
        }
    }
    
    if (!found)
        cout << "Elemento nao encontrado";
    
    return 0;
}